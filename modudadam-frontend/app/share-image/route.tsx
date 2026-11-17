/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const mascotFile = await readFile(path.join(process.cwd(), "public", "brand", "modudadam-guide.png"));
  const mascotImage = mascotFile.buffer.slice(mascotFile.byteOffset, mascotFile.byteOffset + mascotFile.byteLength) as unknown as string;
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", overflow: "hidden", position: "relative", padding: "54px 58px", background: "linear-gradient(135deg, #edf3ff 0%, #fff8ed 58%, #fff 100%)", color: "#172033", fontFamily: "Arial, sans-serif" }}>
      <div style={{ width: 485, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <div style={{ display: "flex", padding: "8px 14px", borderRadius: 999, background: "#fff", color: "#4f73d9", fontSize: 19, fontWeight: 700 }}>모두의 이야기를 한곳에</div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 54, fontWeight: 900, letterSpacing: -3 }}>모두다담</div>
        <div style={{ display: "flex", marginTop: 14, color: "#5f6b7d", fontSize: 24, lineHeight: 1.45 }}>일상의 관심사와 따뜻한 이야기를<br/>함께 나누는 생활 커뮤니티</div>
      </div>
      <img alt="" src={mascotImage} width="300" height="250" style={{ position: "absolute", right: 18, bottom: -7, objectFit: "contain" }}/>
    </div>,
    { width: 800, height: 400 },
  );
}
