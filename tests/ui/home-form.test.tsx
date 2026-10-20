import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { HomeForm } from "@/app/home-form";

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

// The message box shows two lines.
function expectMessage(line1: string, line2: string) {
  const lines = [...screen.getByRole("status").querySelectorAll("p")].map((p) => p.textContent);
  expect(lines).toEqual([line1, line2]);
}

beforeEach(() => {
  push.mockReset();
  vi.unstubAllGlobals();
});

describe("HomeForm", () => {
  it("shows name error when hosting with blank name", async () => {
    const fetchFn = mockFetch(201, { code: "K7PQ" });
    render(<HomeForm />);
    await userEvent.click(screen.getByRole("button", { name: "HOST" }));
    expectMessage("Enter a name.", "It can be 1-10 characters.");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("shows code error when joining without a code", async () => {
    const fetchFn = mockFetch(200, { code: "K7PQ" });
    render(<HomeForm />);
    await userEvent.type(screen.getByLabelText("NAME"), "Ash");
    await userEvent.click(screen.getByRole("button", { name: "JOIN" }));
    expectMessage("Enter a 4-character", "room code.");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("limits the name field to 10 characters", () => {
    render(<HomeForm />);
    expect(screen.getByLabelText("NAME")).toHaveAttribute("maxLength", "10");
  });

  it("shows the hint before any error", () => {
    render(<HomeForm />);
    expectMessage("Enter your name, then host a", "room or join one with a code.");
  });

  it('shows "Room not found." for a 4-character code with excluded characters', async () => {
    const fetchFn = mockFetch(200, { code: "K7PQ" });
    render(<HomeForm />);
    await userEvent.type(screen.getByLabelText("NAME"), "Ash");
    await userEvent.type(screen.getByLabelText("ROOM CODE"), "K0PQ");
    await userEvent.click(screen.getByRole("button", { name: "JOIN" }));
    expectMessage("Room not found.", "Check the code and try again.");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("joins when Enter is pressed in the code field", async () => {
    const fetchFn = mockFetch(200, { code: "K7PQ" });
    render(<HomeForm />);
    await userEvent.type(screen.getByLabelText("NAME"), "Ash");
    await userEvent.type(screen.getByLabelText("ROOM CODE"), "k7pq{Enter}");
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/room/K7PQ"));
    expect(fetchFn).toHaveBeenCalledWith("/api/rooms/K7PQ/join", expect.anything());
  });

  it('shows "Room is full." from a 409', async () => {
    mockFetch(409, { error: "Room is full." });
    render(<HomeForm />);
    await userEvent.type(screen.getByLabelText("NAME"), "Ash");
    await userEvent.type(screen.getByLabelText("ROOM CODE"), "k7pq");
    await userEvent.click(screen.getByRole("button", { name: "JOIN" }));
    expect(await screen.findByText("Room is full.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("navigates to /room/K7PQ after hosting", async () => {
    mockFetch(201, { code: "K7PQ" });
    render(<HomeForm />);
    await userEvent.type(screen.getByLabelText("NAME"), "Ash");
    await userEvent.click(screen.getByRole("button", { name: "HOST" }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/room/K7PQ"));
  });

  it('shows "Room not found." from a 404', async () => {
    mockFetch(404, { error: "Room not found." });
    render(<HomeForm />);
    await userEvent.type(screen.getByLabelText("NAME"), "Ash");
    await userEvent.type(screen.getByLabelText("ROOM CODE"), "k7pq");
    await userEvent.click(screen.getByRole("button", { name: "JOIN" }));
    expect(await screen.findByText("Room not found.")).toBeInTheDocument();
    expectMessage("Room not found.", "Check the code and try again.");
  });

  it("shows a generic error from a 500", async () => {
    mockFetch(500, {});
    render(<HomeForm />);
    await userEvent.type(screen.getByLabelText("NAME"), "Ash");
    await userEvent.click(screen.getByRole("button", { name: "HOST" }));
    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
    expectMessage("Something went wrong.", "Try again.");
  });

  it("renders initialError", () => {
    render(<HomeForm initialError="not-found" />);
    expectMessage("Room not found.", "Check the code and try again.");
  });
});

import { Activity } from "react";

describe("HomeForm when preserved by Activity", () => {
  it("re-enables buttons when shown again after a successful submit", async () => {
    mockFetch(201, { code: "K7PQ" });
    const ui = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <HomeForm />
      </Activity>
    );
    const { rerender } = render(ui("visible"));
    await userEvent.type(screen.getByLabelText("NAME"), "Ash");
    await userEvent.click(screen.getByRole("button", { name: "HOST" }));
    await vi.waitFor(() => expect(push).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "HOST" })).toBeDisabled();
    rerender(ui("hidden"));
    rerender(ui("visible"));
    expect(screen.getByRole("button", { name: "HOST" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "JOIN" })).toBeEnabled();
  });

  it("shows a changed initialError", () => {
    const { rerender } = render(<HomeForm />);
    rerender(<HomeForm initialError="not-found" />);
    expectMessage("Room not found.", "Check the code and try again.");
  });
});
