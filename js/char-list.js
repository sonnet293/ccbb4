// js/char-list.js
import { addItem, bindFields, deleteItem, render, saveItemField, watchList } from "./characters.js";

export function createCharList({ col, listEl, emptyEl, addBtn, defaults, create, focus, deleteLabel, onRender }) {
  let charId = null;
  let unsubscribe = null;
  let pendingFocus = null; // 방금 추가한 항목 → 그려지면 포커스
  const items = new Map(); // itemId → element

  function build(id, itemId) {
    const el = create();
    bindFields(el, (field, value) => saveItemField(id, col, itemId, field, value));
    el.querySelector('[data-action="delete"]')?.addEventListener("click", () => {
      if (confirm(`'${deleteLabel(el)}'를 삭제할까요?`)) deleteItem(id, col, itemId);
    });
    return el;
  }

  function renderAll(list) {
    const ids = new Set(list.map((item) => item.id));
    for (const [itemId, el] of items) {
      if (!ids.has(itemId)) {
        el.remove();
        items.delete(itemId);
      }
    }

    list.forEach((item, i) => {
      let el = items.get(item.id);
      if (!el) {
        el = build(charId, item.id);
        items.set(item.id, el);
      }
      render(el, item);
      if (listEl.children[i] !== el) listEl.insertBefore(el, listEl.children[i] || null);
    });

    emptyEl.hidden = list.length > 0;
    onRender?.();

    if (pendingFocus && items.has(pendingFocus)) {
      const target = items.get(pendingFocus).querySelector(focus);
      pendingFocus = null;
      target.scrollIntoView({ block: "nearest", behavior: "smooth" });
      target.focus();
    }
  }

  addBtn?.addEventListener("click", async () => {
    addBtn.disabled = true;
    pendingFocus = await addItem(charId, col, defaults);
    addBtn.disabled = false;
  });

  return {
    items,
    // 캐릭터가 바뀌면 다시 불러옴 (처음 탭을 열 때 호출)
    show(id) {
      if (id === charId) return false;
      charId = id;
      unsubscribe?.();
      items.clear();
      listEl.textContent = "";
      emptyEl.hidden = true;
      unsubscribe = watchList(id, col, renderAll);
      return true;
    },
  };
}
