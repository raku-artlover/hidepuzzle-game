import { readFileSync } from "node:fs";
import { join } from "node:path";

export default function Home() {
  const gameHtml = readFileSync(join(process.cwd(), "index.html"), "utf8");
  return (
    <iframe
      srcDoc={gameHtml}
      title="HIDE PUZZLE"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0 }}
    />
  );
}
