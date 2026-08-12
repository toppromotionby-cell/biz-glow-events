// Этап 7: единые состояния ошибки/повтора в админке.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { AdminErrorState, AdminErrorInline, errorText } from "./StateViews";
import { AdminTable } from "./AdminTable";

describe("errorText", () => {
  it("берёт message у Error", () => {
    expect(errorText(new Error("нет связи"))).toBe("нет связи");
  });
  it("возвращает fallback для неизвестного", () => {
    expect(errorText(null)).toBe("Не удалось загрузить данные");
    expect(errorText({}, "упс")).toBe("упс");
  });
});

describe("AdminErrorState", () => {
  it("показывает текст ошибки и вызывает повтор", () => {
    const onRetry = vi.fn();
    render(<AdminErrorState error={new Error("500 от сервера")} onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("500 от сервера")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Повторить/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("инлайн-вариант тоже даёт кнопку повтора", () => {
    const onRetry = vi.fn();
    render(<AdminErrorInline error="таймаут" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: /Повторить/ }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("AdminTable states", () => {
  const columns = [{ key: "a", label: "A" }];

  it("ошибка важнее пустого состояния", () => {
    render(
      <AdminTable columns={columns} isError isEmpty error={new Error("сбой")} onRetry={() => {}} />,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Пусто")).not.toBeInTheDocument();
  });

  it("пустое состояние показывает CTA", () => {
    render(<AdminTable columns={columns} isEmpty emptyText="Нет записей" emptyAction={<button>Создать</button>} />);
    expect(screen.getByText("Нет записей")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Создать" })).toBeInTheDocument();
  });
});

/** Нативные confirm/alert блокируют поток и не стилизуются — их не должно остаться. */
describe("нет нативных диалогов", () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) return walk(p);
      return /\.(tsx?|ts)$/.test(name) ? [p] : [];
    });

  it("в src нет window.confirm / alert(", () => {
    const offenders = walk("src").filter((f) => {
      if (f.endsWith("StateViews.test.tsx")) return false;
      const src = readFileSync(f, "utf8");
      return /window\.confirm\(/.test(src) || /(^|[^.\w])alert\(/.test(src);
    });
    expect(offenders).toEqual([]);
  });
});
