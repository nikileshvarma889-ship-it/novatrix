import { test } from "node:test";
import assert from "node:assert/strict";
import { parseChapter } from "../src/bible/importWordproject";

test("parses wordproject chapter markup, skips the site heading, merges a repeated verse number", () => {
  const html = `<h1>WordProject</h1><h2><>పుస్తకం</h2><h3>చాప్టర్ 1</h3>
  <div class="textBody" id="textBody"><p><SPAN class="verse" id="1"> 1 </SPAN> మొదటి&nbsp;వచనం.
  <br><SPAN class="verse" id="2"> 2 </SPAN>రెండవ <b>వచనం</b>¸
  <br><SPAN class="verse" id="2"> 2 </SPAN>కొనసాగింపు.</p></div><div>footer Copyrights</div>`;
  const r = parseChapter(html);
  assert.equal(r.heading, "పుస్తకం");
  assert.deepEqual(r.verses, [{ verse: 1, text: "మొదటి వచనం." }, { verse: 2, text: "రెండవ వచనం కొనసాగింపు." }]);
});
