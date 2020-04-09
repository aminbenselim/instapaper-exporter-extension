let highlights = [];
let page = 1;

async function digestMessage(message) {
  const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8); // hash the message
  const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join(""); // convert bytes to hex string
  return hashHex;
}

const getFromStorage = keys =>
  new Promise((resolve, reject) =>
    chrome.storage.local.get(...keys, result => resolve(result))
  );

const setToStorage = (key, value) =>
  new Promise((resolve, reject) =>
    chrome.storage.local.set({ [key]: value }, result => resolve(result))
  );

async function processJSON(highlights) {
  const docs = {};
  const progress = document.querySelector(".instapaper-exporter-progress");

  highlights.forEach(entry => {
    if (!docs[entry.source]) {
      docs[entry.source] = { entry, text: "" };
    }
    if (entry.highlight) {
      let text = "";
      const h = entry.highlight.trim().split(/\n+/);
      if (h.length === 1) {
        text = `  - ${h[0]}`;
      } else {
        text = `  - ${h[0]}\n${h
          .slice(1)
          .map(x => `    - ${x}\n`)
          .join("")}`;
      }
      docs[entry.source].text += `${text}\n${
        entry.note ? `    - ^^${entry.note}^^ #n\n` : ""
      }`;
    } else if (entry.note) {
      docs[entry.source].text += `  - ^^${entry.note}^^ #n`;
    }
  });
  let roamOutput = [];

  let newCount = 0;
  let changedCount = 0;

  await Promise.all(
    Object.keys(docs).map(async source => {
      const existingHash = await getFromStorage([source]);
      const newHash = await digestMessage(docs[source].text);
      await setToStorage(source, newHash);
      let changed = false;
      if (existingHash[source]) {
        if (existingHash[source] === newHash) {
          return;
        } else {
          changed = true;
          changedCount += 1;
        }
      } else {
        newCount += 1;
      }

      roamOutput.push(
        `- [[${docs[source].entry.title}]] - [link](${
          docs[source].entry.source
        }) #instapaper${changed ? " #instapaper-updated" : ""}\n${
          docs[source].text
        }`
      );
    })
  );
  navigator.clipboard.writeText(roamOutput.join("\n"));

  progress.innerHTML = `<div>Clippings exported to clipboard. Processed ${
    Object.keys(docs).length
  } articles, and extracted ${newCount} new articles, and ${changedCount} changed articles.<br><i><a href="#" id="clear-storage">Click to clear storage</a></i></div>`;
  document.getElementById("clear-storage").addEventListener("click", () => {
    chrome.storage.local.clear();
    progress.innerHTML = "<div>Storage cleared</div>";
  });
}

function scrapePage(parent) {
  let articles = parent.querySelectorAll(".articles .highlight_item");
  let nextPage = parent.querySelector(".paginate_older");
  let progress = document.querySelector(".instapaper-exporter-progress");
  progress.textContent = `Exporting highlights (Page ${page})...`;

  for (var i = 0; i < articles.length; i++) {
    let article = articles[i];
    let titleNode = article.querySelector(".article_title");
    let textNode = article.querySelector(".js_highlight_text");
    let noteNode = article.querySelector(".highlight_comment .comment_text");
    let linkNode = article.querySelector(".host .js_domain_linkout");

    highlights.push({
      title: titleNode.textContent.trim(),
      highlight: textNode.textContent.trim(),
      note: noteNode ? noteNode.textContent.trim() : null,
      source: linkNode ? linkNode.getAttribute("href") : null
    });
  }

  if (nextPage) {
    scrapeNextPage(nextPage.getAttribute("href"));
  } else {
    sendHighlights(highlights);
  }
}

function scrapeNextPage(url) {
  page++;
  let $box = jquery("<div />");
  $box.load(`${url} #main_content`, () => {
    scrapePage($box.get(0));
  });
}

function sendHighlights(highlights) {
  let progress = document.querySelector(".instapaper-exporter-progress");
  progress.textContent = "Processing ...";

  processJSON(highlights);
}

function showProgress() {
  let style = document.createElement("style");
  let progress = document.createElement("div");

  style.textContent = `.instapaper-exporter-progress {
    animation: show 300ms ease;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 99999;
    width: 100%;
    background: #fff;
    box-shadow: 0 0 2px rgba(0,0,0,0.4);
    padding: 20px;
    font-size: 18px;
    font-weight: bold;
    font-family: serif;
    text-align: center;
  }
  @keyframes show {
    from { transform: translate3d(0, -100px, 0); }
    to { transform: translate3d(0, 0, 0); }
  }`;

  progress.classList.add("instapaper-exporter-progress");

  document.head.appendChild(style);
  document.body.appendChild(progress);
}

function handleExtensionMessage(request) {
  if (request.message === "scrape_page") {
    showProgress();
    scrapePage(document);
  }
}

chrome.runtime.onMessage.addListener(handleExtensionMessage);
