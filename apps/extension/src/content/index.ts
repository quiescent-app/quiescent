console.log("Readify content script loaded");

const pageData = {
  title: document.title,
  url: window.location.href,
};

console.log("Readify page data:", pageData);