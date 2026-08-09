import gameHtml from "../index.html?raw&v=78";

export default function Home() {
  return (
    <iframe
      srcDoc={gameHtml}
      title="HIDE PUZZLE"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0 }}
    />
  );
}
