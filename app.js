const form = document.querySelector("#item-form");
const input = document.querySelector("#item-input");
const list = document.querySelector("#shopping-list");
const emptyState = document.querySelector("#empty-state");
const itemCount = document.querySelector("#item-count");
const inputError = document.querySelector("#input-error");
const today = document.querySelector("#today");
const undoToast = document.querySelector("#undo-toast");
const undoButton = document.querySelector("#undo-button");

const STORAGE_KEY = "shopping-list-items";

function loadItems() {
  try {
    const savedItems = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");

    if (!Array.isArray(savedItems)) {
      return [];
    }

    return savedItems
      .filter(
        (item) =>
          item &&
          (typeof item.id === "string" || typeof item.id === "number") &&
          typeof item.name === "string" &&
          item.name.trim(),
      )
      .map((item) => ({
        id: String(item.id),
        name: item.name.trim(),
        completed: item.completed === true,
      }));
  } catch (error) {
    console.warn("買い物リストを読み込めませんでした。", error);
    return [];
  }
}

function saveItems() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn("買い物リストを保存できませんでした。", error);
  }
}

const items = loadItems();
let deletedItem = null;
let undoTimer = null;

today.textContent = new Intl.DateTimeFormat("ja-JP", {
  month: "long",
  day: "numeric",
  weekday: "short",
}).format(new Date());

function updateSummary() {
  const completedCount = items.filter((item) => item.completed).length;
  itemCount.textContent = items.length === 0
    ? "0 件"
    : `${completedCount} / ${items.length} 済み`;
  emptyState.hidden = items.length > 0;
}

function createItemElement(item) {
  const listItem = document.createElement("li");
  const checkTarget = document.createElement("label");
  const checkbox = document.createElement("input");
  const name = document.createElement("label");
  const deleteButton = document.createElement("button");
  const checkboxId = `item-${item.id}`;

  listItem.className = "shopping-item";
  listItem.dataset.id = item.id;
  listItem.classList.toggle("is-completed", item.completed);

  checkbox.className = "item-check";
  checkbox.type = "checkbox";
  checkbox.id = checkboxId;
  checkbox.checked = item.completed;
  checkbox.setAttribute(
    "aria-label",
    item.completed ? `${item.name}を未購入に戻す` : `${item.name}を購入済みにする`,
  );

  checkTarget.className = "check-target";
  checkTarget.htmlFor = checkboxId;
  checkTarget.append(checkbox);

  name.className = "item-name";
  name.htmlFor = checkboxId;
  name.textContent = item.name;

  deleteButton.className = "delete-button";
  deleteButton.type = "button";
  deleteButton.setAttribute("aria-label", `${item.name}を削除`);
  deleteButton.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
    </svg>
  `;

  checkbox.addEventListener("change", () => {
    item.completed = checkbox.checked;
    listItem.classList.toggle("is-completed", item.completed);
    checkbox.setAttribute(
      "aria-label",
      item.completed ? `${item.name}を未購入に戻す` : `${item.name}を購入済みにする`,
    );
    saveItems();
    updateSummary();
  });

  deleteButton.addEventListener("click", () => {
    const index = items.findIndex((candidate) => candidate.id === item.id);
    if (index === -1) {
      return;
    }

    items.splice(index, 1);
    deletedItem = { item, index };
    listItem.remove();
    saveItems();
    updateSummary();
    showUndoToast();
  });

  listItem.append(checkTarget, name, deleteButton);
  return listItem;
}

function showUndoToast() {
  window.clearTimeout(undoTimer);
  undoToast.hidden = false;
  undoTimer = window.setTimeout(() => {
    undoToast.hidden = true;
    deletedItem = null;
  }, 5000);
}

undoButton.addEventListener("click", () => {
  if (!deletedItem) {
    return;
  }

  const { item, index } = deletedItem;
  items.splice(index, 0, item);
  const restoredElement = createItemElement(item);
  list.insertBefore(restoredElement, list.children[index] ?? null);
  saveItems();
  updateSummary();

  window.clearTimeout(undoTimer);
  undoToast.hidden = true;
  deletedItem = null;
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const itemName = input.value.trim();

  if (!itemName) {
    input.setAttribute("aria-invalid", "true");
    inputError.textContent = "商品名を入力してください。";
    input.focus();
    return;
  }

  const item = {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    name: itemName,
    completed: false,
  };

  items.push(item);
  list.append(createItemElement(item));
  saveItems();
  input.value = "";
  input.removeAttribute("aria-invalid");
  inputError.textContent = "";
  updateSummary();
  input.focus();
});

input.addEventListener("input", () => {
  if (input.value.trim()) {
    input.removeAttribute("aria-invalid");
    inputError.textContent = "";
  }
});

items.forEach((item) => list.append(createItemElement(item)));
updateSummary();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js", { scope: "./" })
      .catch((error) => {
        console.warn("オフライン機能を有効にできませんでした。", error);
      });
  });
}
