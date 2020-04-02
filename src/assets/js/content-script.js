"use strict";
import $ from "jquery";
let highlights = [];
let page = 1;

function processJSON(highlights) {
  const docs = {};
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
  Object.keys(docs).forEach(source => {
    roamOutput.push(
      `- [[${docs[source].entry.title}]] - [link](${
        docs[source].entry.source
      }) #instapaper\n${docs[source].text}`
    );
  });
  navigator.clipboard.writeText(roamOutput.join("\n"));
  // can't display this immediately, because it will stop the clipboard from working
  window.setTimeout(() => window.alert("Clippings copied to clipboard"), 2000);
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
  let $box = $("<div />");
  $box.load(`${url} #main_content`, () => {
    scrapePage($box.get(0));
  });
}

function sendHighlights(highlights) {
  let progress = document.querySelector(".instapaper-exporter-progress");
  document.body.removeChild(progress);
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
