// @vitest-environment jsdom
// Smoke-тесты компонента SaveStatus: все состояния редактора.
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { SaveStatus } from "./SaveStatus";

afterEach(() => cleanup());

describe("<SaveStatus />", () => {
  it("idle без черновика не рендерит ничего", () => {
    const { container } = render(<SaveStatus state="idle" />);
    expect(container.firstChild).toBeNull();
  });

  it("saving — показывает индикатор сохранения и live-region", () => {
    render(<SaveStatus state="saving" />);
    expect(screen.getByText(/Сохраняем/)).toBeTruthy();
    expect(screen.getByText(/Сохраняем/).closest("[aria-live]")).toBeTruthy();
  });

  it("saved — зелёный «Сохранено»", () => {
    render(<SaveStatus state="saved" />);
    expect(screen.getByText("Сохранено")).toBeTruthy();
  });

  it("error — role=alert и текст ошибки", () => {
    render(<SaveStatus state="error" errorMessage="Permission denied" />);
    const node = screen.getByRole("alert");
    expect(node.textContent).toContain("Permission denied");
  });

  it("dirty с draftSavedAt — показывает время черновика", () => {
    render(<SaveStatus state="dirty" draftSavedAt={new Date("2026-06-19T09:30:00")} />);
    expect(screen.getByText(/Есть изменения/)).toBeTruthy();
    expect(screen.getByText(/черновик/)).toBeTruthy();
  });

  it("idle + draftSavedAt — показывает только черновик", () => {
    render(<SaveStatus state="idle" draftSavedAt={new Date()} />);
    expect(screen.getByText(/черновик/)).toBeTruthy();
  });
});
