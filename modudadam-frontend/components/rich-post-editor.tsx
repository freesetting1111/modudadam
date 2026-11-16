"use client";

import { ChangeEvent, forwardRef, KeyboardEvent, MouseEvent, PointerEvent, useEffect, useImperativeHandle, useRef, useState } from "react";
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
    for (const image of initialImages) {
      if (!editor.querySelector(`figure[data-image-id="${image.id}"]`)) {
        const figure = createFigure(image.id, image.url, image.originalName, "ready");
        editor.append(figure, createEmptyParagraph());
        imageInfoRef.current.set(image.id, { existing: true });
      }
    }
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
    document.execCommand(command, false, value);
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
      range.insertNode(figure);
      const paragraph = createEmptyParagraph();
      figure.after(paragraph);
      const nextRange = document.createRange();
      nextRange.selectNodeContents(paragraph);
      nextRange.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(nextRange);
      savedRangeRef.current = nextRange.cloneRange();
    } else {
      editor.append(figure, createEmptyParagraph());
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
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-remove-image]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    removeFigure(button.closest<HTMLElement>("figure.editor-inline-image"));
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled || (event.key !== "Backspace" && event.key !== "Delete")) return;
    const figures = findFiguresForDeletion(editorRef.current, event.key);
    if (!figures.length) return;
    event.preventDefault();
    for (const figure of figures) removeFigure(figure, false);
    ensureEditableParagraph();
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
    const localId = figure.dataset.localId;
    const imageId = figure.dataset.imageId;
    if (imageId) {
      const info = imageInfoRef.current.get(imageId);
      if (info && !info.existing) void apiRequest(`/api/uploads/${imageId}`, { method: "DELETE" }).catch(() => undefined);
      if (info?.objectUrl) URL.revokeObjectURL(info.objectUrl);
      imageInfoRef.current.delete(imageId);
    }
    if (localId) {
      pendingFilesRef.current.delete(localId);
      const info = imageInfoRef.current.get(localId);
      if (info?.objectUrl) URL.revokeObjectURL(info.objectUrl);
      imageInfoRef.current.delete(localId);
    }
    figure.remove();
    ensureEditableParagraph();
    if (shouldEmit) emitChange();
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
      onInput={emitChange}
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
        document.execCommand("insertText", false, text);
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
