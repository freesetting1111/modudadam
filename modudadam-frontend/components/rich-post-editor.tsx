"use client";

import { ChangeEvent, FocusEvent, FormEvent, forwardRef, KeyboardEvent, MouseEvent, PointerEvent, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Bold, ImagePlus, Italic, Quote } from "lucide-react";
import { apiRequest } from "@/lib/api";

export type EditorImage = {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
};

export type EditorValue = {
  content: string;
  contentHtml: string;
  imageIds: string[];
  imageCount: number;
  uploading: boolean;
};

export type PreparedEditorValue = {
  value: EditorValue;
  newUploadIds: string[];
};

export type RichPostEditorHandle = {
  prepareForSubmit: () => Promise<PreparedEditorValue>;
  commitUploads: (uploadIds: string[]) => void;
  rollbackUploads: (uploadIds: string[]) => Promise<void>;
};

type RichPostEditorProps = {
  initialContent: string;
  initialContentHtml: string;
  initialImages: EditorImage[];
  resetKey: string;
  disabled: boolean;
  onChange: (value: EditorValue) => void;
  onError: (message: string) => void;
};

const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_HISTORY_ENTRIES = 50;
const HISTORY_GROUP_DELAY_MS = 800;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const RichPostEditor = forwardRef<RichPostEditorHandle, RichPostEditorProps>(function RichPostEditor({
  initialContent,
  initialContentHtml,
  initialImages,
  resetKey,
  disabled,
  onChange,
  onError,
}: RichPostEditorProps, ref) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const imageInfoRef = useRef(new Map<string, { existing: boolean; objectUrl?: string }>());
  const pendingFilesRef = useRef(new Map<string, File>());
  const historyRef = useRef({
    undo: [] as string[],
    redo: [] as string[],
    current: "",
    lastInputType: "",
    lastInputAt: 0,
  });
  const [imageCount, setImageCount] = useState(initialImages.length);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    imageInfoRef.current.clear();
    const imageMap = new Map(initialImages.map((image) => [image.id, image]));
    editor.innerHTML = initialContentHtml || textToHtml(initialContent);
    editor.querySelectorAll<HTMLElement>("figure[data-image-id]").forEach((figure) => {
      const imageId = figure.dataset.imageId || "";
      const image = imageMap.get(imageId);
      if (!image) {
        figure.remove();
        return;
      }
      imageInfoRef.current.set(imageId, { existing: true });
      decorateFigure(figure, image.url, image.originalName);
    });
    const hasMissingImagePositions = initialImages.some((image) => !editor.querySelector(`figure[data-image-id="${image.id}"]`));
    if (hasMissingImagePositions) {
      editor.querySelectorAll<HTMLElement>("p,div,blockquote").forEach((block) => {
        if (isVisuallyEmpty(block)) block.remove();
      });
    }
    for (const image of initialImages) {
      if (!editor.querySelector(`figure[data-image-id="${image.id}"]`)) {
        const figure = createFigure(image.id, image.url, image.originalName, "ready");
        editor.append(figure, createEmptyParagraph());
        imageInfoRef.current.set(image.id, { existing: true });
      }
    }
    refreshImageInsertionControls(editor);
    resetHistory(editor.innerHTML);
    emitChange();
    // resetKey intentionally controls when the editor is rehydrated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => () => {
    for (const info of imageInfoRef.current.values()) {
      if (info.objectUrl) URL.revokeObjectURL(info.objectUrl);
    }
  }, []);

  function saveSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) savedRangeRef.current = range.cloneRange();
  }

  function restoreSelection() {
    const selection = window.getSelection();
    if (!selection || !savedRangeRef.current) return;
    selection.removeAllRanges();
    selection.addRange(savedRangeRef.current);
  }

  function format(command: "bold" | "italic" | "formatBlock", value?: string) {
    editorRef.current?.focus();
    restoreSelection();
    recordHistoryCheckpoint();
    document.execCommand(command, false, value);
    syncHistoryCurrent();
    saveSelection();
    emitChange();
  }

  function openImagePicker() {
    if (imageCount >= MAX_IMAGES) {
      onError(`이미지는 최대 ${MAX_IMAGES}장까지 넣을 수 있습니다.`);
      return;
    }
    saveSelection();
    fileRef.current?.click();
  }

  function selectImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    queueImages(files);
  }

  function queueImages(sourceFiles: File[]) {
    if (!sourceFiles.length) return;
    const currentCount = editorRef.current?.querySelectorAll("figure.editor-inline-image").length || 0;
    if (currentCount + sourceFiles.length > MAX_IMAGES) {
      onError(`이미지는 최대 ${MAX_IMAGES}장까지 넣을 수 있습니다.`);
      return;
    }
    const invalid = sourceFiles.find((file) => !ALLOWED_IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES);
    if (invalid) {
      onError("JPG, PNG, WebP 형식의 10MB 이하 이미지만 넣을 수 있습니다.");
      return;
    }
    onError("");
    recordHistoryCheckpoint();
    for (const [index, sourceFile] of sourceFiles.entries()) {
      const file = sourceFile.name ? sourceFile : new File(
        [sourceFile],
        `clipboard-${Date.now()}-${index + 1}.${extensionForMimeType(sourceFile.type)}`,
        { type: sourceFile.type },
      );
      const localId = crypto.randomUUID();
      const objectUrl = URL.createObjectURL(file);
      const figure = createFigure(localId, objectUrl, file.name, "pending");
      figure.dataset.localId = localId;
      imageInfoRef.current.set(localId, { existing: false, objectUrl });
      pendingFilesRef.current.set(localId, file);
      insertFigureAtSelection(figure);
    }
    refreshImageInsertionControls(editorRef.current);
    syncHistoryCurrent();
    emitChange();
  }

  function insertFigureAtSelection(figure: HTMLElement) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    restoreSelection();
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (range && editor.contains(range.commonAncestorContainer)) {
      range.deleteContents();
      range.collapse(true);
      if (range.startContainer === editor) {
        const nextNode = editor.childNodes[range.startOffset] || null;
        editor.insertBefore(figure, nextNode);
        const nextBlock = figure.nextElementSibling instanceof HTMLElement
          ? figure.nextElementSibling
          : createGeneratedParagraph(figure);
        savedRangeRef.current = placeCaretAtStart(nextBlock);
        return;
      }

      const block = closestDirectChild(editor, range.startContainer);
      if (block && !block.matches("figure.editor-inline-image")) {
        const tailRange = document.createRange();
        tailRange.selectNodeContents(block);
        tailRange.setStart(range.startContainer, range.startOffset);
        const tail = tailRange.extractContents();
        const afterBlock = block.cloneNode(false) as HTMLElement;
        afterBlock.removeAttribute("data-editor-generated");
        afterBlock.append(tail);
        if (isVisuallyEmpty(afterBlock)) {
          afterBlock.replaceChildren(document.createElement("br"));
          afterBlock.dataset.editorGenerated = "true";
        }
        block.after(figure, afterBlock);
        if (isVisuallyEmpty(block)) block.remove();
        savedRangeRef.current = placeCaretAtStart(afterBlock);
        return;
      }

      range.insertNode(figure);
      const paragraph = createGeneratedParagraph(figure);
      savedRangeRef.current = placeCaretAtStart(paragraph);
    } else {
      editor.append(figure);
      savedRangeRef.current = placeCaretAtStart(createGeneratedParagraph(figure));
    }
  }

  async function uploadPendingImage(localId: string, file: File, figure: HTMLElement) {
    let uploadId = "";
    figure.classList.remove("pending", "upload-error");
    figure.classList.add("uploading");
    emitChange();
    try {
      const prepared = await apiRequest<{ id: string; uploadUrl: string }>("/api/uploads", {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, byteSize: file.size }),
      });
      uploadId = prepared.id;
      let uploaded: Response;
      try {
        uploaded = await fetch(prepared.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
      } catch {
        throw new Error("S3에 연결하지 못했습니다. 버킷 CORS와 리전 설정을 확인해 주세요.");
      }
      if (!uploaded.ok) {
        throw new Error(uploaded.status === 403
          ? "S3 업로드가 거부되었습니다. IAM 권한, 버킷 리전과 액세스 키를 확인해 주세요."
          : `이미지 업로드에 실패했습니다. (${uploaded.status})`);
      }
      await apiRequest(`/api/uploads/${uploadId}/complete`, { method: "POST", body: "{}" });
      if (!document.contains(figure)) {
        await apiRequest(`/api/uploads/${uploadId}`, { method: "DELETE" });
        throw new Error("본문에서 삭제된 이미지입니다.");
      }
      figure.dataset.imageId = uploadId;
      figure.classList.remove("uploading", "upload-error", "pending");
      const oldInfo = imageInfoRef.current.get(localId);
      imageInfoRef.current.set(uploadId, { existing: false, objectUrl: oldInfo?.objectUrl });
      emitChange();
      return uploadId;
    } catch (caught) {
      if (uploadId) void apiRequest(`/api/uploads/${uploadId}`, { method: "DELETE" }).catch(() => undefined);
      if (document.contains(figure)) {
        figure.classList.remove("uploading");
        figure.classList.add("upload-error");
      }
      onError(caught instanceof Error ? caught.message : "이미지를 업로드하지 못했습니다.");
      emitChange();
      throw caught;
    }
  }

  async function prepareForSubmit(): Promise<PreparedEditorValue> {
    const uploaded: Array<{ localId: string; uploadId: string }> = [];
    try {
      for (const [localId, file] of pendingFilesRef.current.entries()) {
        const figure = editorRef.current?.querySelector<HTMLElement>(`figure[data-local-id="${localId}"]`);
        if (!figure || figure.dataset.imageId) continue;
        const uploadId = await uploadPendingImage(localId, file, figure);
        uploaded.push({ localId, uploadId });
      }
      const value = readEditorValue();
      if (value.uploading) throw new Error("이미지 업로드를 완료하지 못했습니다.");
      return { value, newUploadIds: uploaded.map((item) => item.uploadId) };
    } catch (error) {
      await rollbackUploads(uploaded.map((item) => item.uploadId));
      throw error;
    }
  }

  function commitUploads(uploadIds: string[]) {
    for (const uploadId of uploadIds) {
      const figure = editorRef.current?.querySelector<HTMLElement>(`figure[data-image-id="${uploadId}"]`);
      const localId = figure?.dataset.localId;
      if (localId) {
        pendingFilesRef.current.delete(localId);
        imageInfoRef.current.delete(localId);
      }
      figure?.removeAttribute("data-local-id");
    }
  }

  async function rollbackUploads(uploadIds: string[]) {
    await Promise.allSettled(uploadIds.map((uploadId) => apiRequest(`/api/uploads/${uploadId}`, { method: "DELETE" })));
    for (const uploadId of uploadIds) {
      const figure = editorRef.current?.querySelector<HTMLElement>(`figure[data-image-id="${uploadId}"]`);
      if (!figure) continue;
      delete figure.dataset.imageId;
      figure.classList.remove("uploading", "upload-error");
      figure.classList.add("pending");
      figure.querySelector(".editor-image-status")?.remove();
      imageInfoRef.current.delete(uploadId);
    }
    emitChange();
  }

  useImperativeHandle(ref, () => ({ prepareForSubmit, commitUploads, rollbackUploads }));

  function handleEditorClick(event: MouseEvent<HTMLDivElement>) {
    if (disabled) return;
    const insertionButton = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-insert-image-text]");
    if (insertionButton) {
      event.preventDefault();
      event.stopPropagation();
      activateImageTextInsertion(insertionButton);
      return;
    }
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-remove-image]");
    if (button) {
      event.preventDefault();
      event.stopPropagation();
      removeFigure(button.closest<HTMLElement>("figure.editor-inline-image"));
      return;
    }
    const figure = (event.target as HTMLElement).closest<HTMLElement>("figure.editor-inline-image");
    if (figure) selectFigure(figure);
  }

  function handleEditorPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    const insertionButton = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-insert-image-text]");
    if (insertionButton) {
      event.preventDefault();
      return;
    }
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-remove-image]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    removeFigure(button.closest<HTMLElement>("figure.editor-inline-image"));
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redoEditorHistory();
      else undoEditorHistory();
      return;
    }
    if (modifier && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redoEditorHistory();
      return;
    }
    if (event.key === "Enter") {
      markCurrentBlockAsAuthored();
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      if (moveAcrossImage(event.key)) event.preventDefault();
      return;
    }
    if (event.key !== "Backspace" && event.key !== "Delete") return;
    const figures = findFiguresForDeletion(editorRef.current, event.key);
    if (!figures.length) return;
    event.preventDefault();
    removeEmptyBlockBesideImage(event.key, figures[0]);
  }

  function handleEditorBeforeInput(event: FormEvent<HTMLDivElement>) {
    if (disabled) return;
    const inputType = (event.nativeEvent as InputEvent).inputType || "unknown";
    if (inputType === "historyUndo" || inputType === "historyRedo") {
      event.preventDefault();
      if (inputType === "historyUndo") undoEditorHistory();
      else redoEditorHistory();
      return;
    }
    const now = Date.now();
    const history = historyRef.current;
    const groupable = /^(insertText|deleteContentBackward|deleteContentForward)$/.test(inputType);
    const continuesGroup = groupable
      && history.lastInputType === inputType
      && now - history.lastInputAt < HISTORY_GROUP_DELAY_MS;
    if (!continuesGroup) recordHistoryCheckpoint(false);
    history.lastInputType = inputType;
    history.lastInputAt = now;
  }

  function removeEmptyBlockBesideImage(key: "Backspace" | "Delete", figure: HTMLElement) {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!range.collapsed) return;
    const block = closestDirectChild(editor, range.startContainer);
    if (!block || !isVisuallyEmpty(block)) return;
    const expectedFigure = key === "Delete" ? block.nextElementSibling : block.previousElementSibling;
    if (expectedFigure !== figure) return;

    recordHistoryCheckpoint();
    const caretTarget = key === "Delete" ? block.previousElementSibling : block.nextElementSibling;
    block.remove();
    refreshImageInsertionControls(editor);
    if (caretTarget instanceof HTMLElement && !caretTarget.matches("figure.editor-inline-image")) {
      savedRangeRef.current = key === "Delete" ? placeCaretAtEnd(caretTarget) : placeCaretAtStart(caretTarget);
    } else {
      savedRangeRef.current = placeCaretNextToFigure(editor, figure, key === "Delete" ? "before" : "after");
    }
    syncHistoryCurrent();
    emitChange();
  }

  function activateImageTextInsertion(button: HTMLButtonElement) {
    const editor = editorRef.current;
    if (!editor || !editor.contains(button)) return;
    recordHistoryCheckpoint();
    const paragraph = createEmptyParagraph();
    paragraph.dataset.editorGenerated = "true";
    paragraph.dataset.imageInsertion = "true";
    button.replaceWith(paragraph);
    savedRangeRef.current = placeCaretAtStart(paragraph);
    syncHistoryCurrent();
    emitChange();
  }

  function handleEditorBlur(event: FocusEvent<HTMLDivElement>) {
    const editor = editorRef.current;
    if (!editor || (event.relatedTarget instanceof Node && editor.contains(event.relatedTarget))) return;
    let changed = false;
    editor.querySelectorAll<HTMLElement>("[data-image-insertion]").forEach((block) => {
      if (!isVisuallyEmpty(block)) return;
      block.remove();
      changed = true;
    });
    if (!changed) return;
    refreshImageInsertionControls(editor);
    syncHistoryCurrent();
    emitChange();
  }

  function markCurrentBlockAsAuthored() {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const block = closestDirectChild(editor, selection.getRangeAt(0).startContainer);
    block?.removeAttribute("data-editor-generated");
  }

  function moveAcrossImage(key: "ArrowUp" | "ArrowDown") {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return false;
    const range = selection.getRangeAt(0);
    if (!range.collapsed || !editor.contains(range.startContainer)) return false;

    const block = closestDirectChild(editor, range.startContainer);
    if (block && !block.matches("figure.editor-inline-image")) {
      const atBoundary = key === "ArrowUp" ? isCaretAtStart(block, range) : isCaretAtEnd(block, range);
      if (!atBoundary) return false;
      const figure = key === "ArrowUp" ? block.previousElementSibling : block.nextElementSibling;
      if (!(figure instanceof HTMLElement) || !figure.matches("figure.editor-inline-image")) return false;
      const target = key === "ArrowUp" ? getOrCreateBlockBefore(figure) : getOrCreateBlockAfter(figure);
      savedRangeRef.current = key === "ArrowUp" && !isVisuallyEmpty(target) ? placeCaretAtEnd(target) : placeCaretAtStart(target);
      return true;
    }

    if (range.startContainer === editor) {
      const figureIndex = range.startOffset + (key === "ArrowUp" ? -1 : 0);
      const figure = editor.childNodes[figureIndex];
      if (!(figure instanceof HTMLElement) || !figure.matches("figure.editor-inline-image")) return false;
      const target = key === "ArrowUp" ? getOrCreateBlockBefore(figure) : getOrCreateBlockAfter(figure);
      savedRangeRef.current = key === "ArrowUp" && !isVisuallyEmpty(target) ? placeCaretAtEnd(target) : placeCaretAtStart(target);
      return true;
    }
    return false;
  }

  function getOrCreateBlockBefore(figure: HTMLElement) {
    const previous = figure.previousElementSibling;
    if (previous instanceof HTMLElement && !previous.matches("figure.editor-inline-image")) return previous;
    const paragraph = createEmptyParagraph();
    paragraph.dataset.editorGenerated = "true";
    figure.before(paragraph);
    return paragraph;
  }

  function getOrCreateBlockAfter(figure: HTMLElement) {
    const next = figure.nextElementSibling;
    if (next instanceof HTMLElement && !next.matches("figure.editor-inline-image")) return next;
    return createGeneratedParagraph(figure);
  }

  function handleEditorInput() {
    editorRef.current?.querySelectorAll<HTMLElement>("[data-editor-generated]").forEach((block) => {
      if (!isVisuallyEmpty(block)) {
        block.removeAttribute("data-editor-generated");
        block.removeAttribute("data-image-insertion");
      }
    });
    refreshImageInsertionControls(editorRef.current);
    syncHistoryCurrent();
    emitChange();
  }

  function recordHistoryCheckpoint(resetInputGroup = true) {
    const editor = editorRef.current;
    if (!editor) return;
    const history = historyRef.current;
    const snapshot = editor.innerHTML;
    if (history.undo.at(-1) !== snapshot) {
      history.undo.push(snapshot);
      if (history.undo.length > MAX_HISTORY_ENTRIES) history.undo.shift();
    }
    history.current = snapshot;
    history.redo = [];
    if (resetInputGroup) {
      history.lastInputType = "";
      history.lastInputAt = 0;
    }
  }

  function syncHistoryCurrent() {
    const editor = editorRef.current;
    if (editor) historyRef.current.current = editor.innerHTML;
  }

  function resetHistory(snapshot: string) {
    historyRef.current = { undo: [], redo: [], current: snapshot, lastInputType: "", lastInputAt: 0 };
  }

  function undoEditorHistory() {
    const editor = editorRef.current;
    const history = historyRef.current;
    const previous = history.undo.pop();
    if (!editor || previous === undefined) return;
    history.redo.push(editor.innerHTML);
    restoreHistorySnapshot(previous);
  }

  function redoEditorHistory() {
    const editor = editorRef.current;
    const history = historyRef.current;
    const next = history.redo.pop();
    if (!editor || next === undefined) return;
    history.undo.push(editor.innerHTML);
    restoreHistorySnapshot(next);
  }

  function restoreHistorySnapshot(snapshot: string) {
    const editor = editorRef.current;
    if (!editor) return;
    editor.innerHTML = snapshot;
    refreshImageInsertionControls(editor);
    historyRef.current.current = snapshot;
    historyRef.current.lastInputType = "";
    historyRef.current.lastInputAt = 0;
    const lastEditableBlock = Array.from(editor.children)
      .reverse()
      .find((node): node is HTMLElement => node instanceof HTMLElement && !node.matches("figure.editor-inline-image"));
    savedRangeRef.current = lastEditableBlock ? placeCaretAtEnd(lastEditableBlock) : placeCaretAtEnd(editor);
    emitChange();
  }

  function selectFigure(figure: HTMLElement) {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNode(figure);
    selection.removeAllRanges();
    selection.addRange(range);
    savedRangeRef.current = range.cloneRange();
  }

  function removeFigure(figure: HTMLElement | null, shouldEmit = true) {
    if (!figure || !editorRef.current?.contains(figure)) return;
    if (shouldEmit) recordHistoryCheckpoint();
    // 업로드 대기 정보와 object URL은 undo로 이미지를 복원할 수 있도록
    // 편집기가 닫힐 때까지 보관합니다. 저장 시 DOM에 남은 이미지만 처리됩니다.
    figure.remove();
    ensureEditableParagraph();
    refreshImageInsertionControls(editorRef.current);
    if (shouldEmit) {
      syncHistoryCurrent();
      emitChange();
    }
  }

  function ensureEditableParagraph() {
    const editor = editorRef.current;
    if (!editor) return;
    if (!editor.querySelector("p,div,blockquote") && !editor.textContent?.trim()) {
      editor.append(createEmptyParagraph());
    }
  }

  function readEditorValue(): EditorValue {
    const editor = editorRef.current;
    if (!editor) return { content: "", contentHtml: "", imageIds: [], imageCount: 0, uploading: false };
    const clone = editor.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("button,.editor-image-status").forEach((node) => node.remove());
    clone.querySelectorAll<HTMLElement>("[data-editor-generated]").forEach((block) => {
      if (isVisuallyEmpty(block)) block.remove();
      else block.removeAttribute("data-editor-generated");
    });
    clone.querySelectorAll<HTMLElement>("figure.editor-inline-image").forEach((figure) => {
      const imageId = figure.dataset.imageId;
      if (!imageId) {
        figure.remove();
        return;
      }
      figure.className = "post-inline-image";
      figure.removeAttribute("contenteditable");
      figure.removeAttribute("data-local-id");
      figure.innerHTML = "";
    });
    const textClone = clone.cloneNode(true) as HTMLElement;
    textClone.querySelectorAll("figure").forEach((figure) => figure.remove());
    const content = extractPlainText(textClone);
    const imageIds = Array.from(clone.querySelectorAll<HTMLElement>("figure[data-image-id]"))
      .map((figure) => figure.dataset.imageId || "")
      .filter(Boolean);
    const uploading = Boolean(editor.querySelector("figure.uploading"));
    const nextImageCount = editor.querySelectorAll("figure.editor-inline-image").length;
    return { content, contentHtml: clone.innerHTML, imageIds, imageCount: nextImageCount, uploading };
  }

  function emitChange() {
    const value = readEditorValue();
    const nextImageCount = value.imageCount;
    setImageCount(nextImageCount);
    onChange(value);
  }

  return <div className="rich-editor-shell">
    <div className="rich-editor-toolbar" aria-label="본문 편집 도구">
      <button type="button" title="굵게" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => format("bold")}><Bold size={17}/></button>
      <button type="button" title="기울임" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => format("italic")}><Italic size={17}/></button>
      <button type="button" title="인용문" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => format("formatBlock", "blockquote")}><Quote size={17}/></button>
      <span/>
      <button className="rich-editor-image-button" type="button" onMouseDown={(event) => event.preventDefault()} onClick={openImagePicker} disabled={disabled || imageCount >= MAX_IMAGES}><ImagePlus size={18}/> 이미지</button>
      <small>{imageCount}/{MAX_IMAGES}</small>
    </div>
    <div
      ref={editorRef}
      className="rich-editor-content"
      contentEditable={!disabled}
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      data-placeholder="함께 나누고 싶은 경험과 정보를 작성해 주세요."
      onBeforeInput={handleEditorBeforeInput}
      onInput={handleEditorInput}
      onBlur={handleEditorBlur}
      onFocus={saveSelection}
      onKeyUp={saveSelection}
      onMouseUp={saveSelection}
      onPointerDown={handleEditorPointerDown}
      onClick={handleEditorClick}
      onKeyDown={handleEditorKeyDown}
      onPaste={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        const clipboardImages = Array.from(event.clipboardData.items)
          .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
          .map((item) => item.getAsFile())
          .filter((file): file is File => Boolean(file));
        if (clipboardImages.length) {
          event.preventDefault();
          saveSelection();
          queueImages(clipboardImages);
          return;
        }
        event.preventDefault();
        const text = event.clipboardData.getData("text/plain");
        recordHistoryCheckpoint();
        document.execCommand("insertText", false, text);
        syncHistoryCurrent();
        emitChange();
      }}
    />
    <input ref={fileRef} className="image-file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={selectImages}/>
    <p className="rich-editor-help"><ImagePlus size={14}/> 클립보드 이미지를 Ctrl+V로 붙여넣거나 이미지 버튼을 이용하세요. 최대 10장 · 파일당 10MB</p>
  </div>;
});

function createFigure(id: string, imageUrl: string, fileName: string, state: "ready" | "pending") {
  const figure = document.createElement("figure");
  figure.className = `editor-inline-image${state === "pending" ? " pending" : ""}`;
  figure.contentEditable = "false";
  if (state === "ready") figure.dataset.imageId = id;
  decorateFigure(figure, imageUrl, fileName);
  return figure;
}

function decorateFigure(figure: HTMLElement, imageUrl: string, fileName: string) {
  figure.classList.add("editor-inline-image");
  figure.contentEditable = "false";
  figure.innerHTML = "";
  const image = document.createElement("img");
  image.src = imageUrl;
  image.alt = fileName;
  const remove = document.createElement("button");
  remove.type = "button";
  remove.dataset.removeImage = "true";
  remove.setAttribute("aria-label", `${fileName} 삭제`);
  remove.innerHTML = `<span aria-hidden="true">×</span>`;
  figure.append(image, remove);
}

function createEmptyParagraph() {
  const paragraph = document.createElement("p");
  paragraph.append(document.createElement("br"));
  return paragraph;
}

function createGeneratedParagraph(after: HTMLElement) {
  const paragraph = createEmptyParagraph();
  paragraph.dataset.editorGenerated = "true";
  after.after(paragraph);
  return paragraph;
}

function refreshImageInsertionControls(editor: HTMLElement | null) {
  if (!editor) return;
  editor.querySelectorAll("button[data-insert-image-text]").forEach((button) => button.remove());
  const children = Array.from(editor.children).filter((child): child is HTMLElement => child instanceof HTMLElement);
  if (!children.length) return;

  const isFigure = (element: HTMLElement) => element.matches("figure.editor-inline-image");
  if (isFigure(children[0])) children[0].before(createImageInsertionControl("before"));
  for (let index = 0; index < children.length - 1; index += 1) {
    if (isFigure(children[index]) && isFigure(children[index + 1])) {
      children[index].after(createImageInsertionControl("between"));
    }
  }
  const last = children.at(-1);
  if (last && isFigure(last)) last.after(createImageInsertionControl("after"));
}

function createImageInsertionControl(position: "before" | "between" | "after") {
  const button = document.createElement("button");
  button.type = "button";
  button.contentEditable = "false";
  button.className = "editor-image-insert-point";
  button.dataset.insertImageText = position;
  button.setAttribute("aria-label", position === "between" ? "이미지 사이에 글 입력" : "이미지 옆에 글 입력");
  const label = document.createElement("span");
  label.textContent = "글 입력";
  button.append(label);
  return button;
}

function placeCaretAtStart(element: HTMLElement) {
  const selection = window.getSelection();
  if (!selection) return null;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  return range.cloneRange();
}

function placeCaretAtEnd(element: HTMLElement) {
  const selection = window.getSelection();
  if (!selection) return null;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  return range.cloneRange();
}

function placeCaretNextToFigure(editor: HTMLElement, figure: HTMLElement, side: "before" | "after") {
  const selection = window.getSelection();
  if (!selection) return null;
  const range = document.createRange();
  const index = Array.from(editor.childNodes).indexOf(figure);
  range.setStart(editor, Math.max(0, index + (side === "after" ? 1 : 0)));
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
  return range.cloneRange();
}

function isVisuallyEmpty(element: HTMLElement) {
  return !element.textContent?.replace(/\u00a0/g, " ").trim()
    && !element.querySelector("img,figure,video,iframe");
}

function findFiguresForDeletion(editor: HTMLElement | null, key: "Backspace" | "Delete") {
  if (!editor) return [];
  const selection = window.getSelection();
  if (!selection?.rangeCount) return [];
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return [];
  const figures = Array.from(editor.querySelectorAll<HTMLElement>("figure.editor-inline-image"));
  if (!range.collapsed) return figures.filter((figure) => range.intersectsNode(figure));

  const directFigure = closestFigure(range.startContainer);
  if (directFigure) return [directFigure];

  if (range.startContainer === editor) {
    const index = range.startOffset + (key === "Backspace" ? -1 : 0);
    const candidate = editor.childNodes[index];
    return candidate instanceof HTMLElement && candidate.matches("figure.editor-inline-image") ? [candidate] : [];
  }

  const block = closestDirectChild(editor, range.startContainer);
  if (!block) return [];
  const atBoundary = key === "Backspace" ? isCaretAtStart(block, range) : isCaretAtEnd(block, range);
  if (!atBoundary) return [];
  const sibling = key === "Backspace" ? block.previousElementSibling : block.nextElementSibling;
  return sibling instanceof HTMLElement && sibling.matches("figure.editor-inline-image") ? [sibling] : [];
}

function closestFigure(node: Node) {
  const element = node instanceof HTMLElement ? node : node.parentElement;
  return element?.closest<HTMLElement>("figure.editor-inline-image") || null;
}

function closestDirectChild(editor: HTMLElement, node: Node) {
  let current: Node | null = node instanceof HTMLElement ? node : node.parentElement;
  while (current?.parentNode && current.parentNode !== editor) current = current.parentNode;
  return current instanceof HTMLElement && current.parentNode === editor ? current : null;
}

function isCaretAtStart(block: HTMLElement, range: Range) {
  const before = document.createRange();
  before.selectNodeContents(block);
  before.setEnd(range.startContainer, range.startOffset);
  return before.toString() === "";
}

function isCaretAtEnd(block: HTMLElement, range: Range) {
  const after = document.createRange();
  after.selectNodeContents(block);
  after.setStart(range.startContainer, range.startOffset);
  return after.toString() === "";
}

function textToHtml(value: string) {
  if (!value) return "<p><br></p>";
  return value.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] || character));
}

function extractPlainText(element: HTMLElement) {
  const textContainer = document.createElement("div");
  textContainer.innerHTML = element.innerHTML
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|blockquote|li|ul|ol)>/gi, "\n");
  return (textContainer.textContent || "").replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}
