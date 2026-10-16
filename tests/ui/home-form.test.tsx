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

beforeEach(() => {
  push.mockReset();
  vi.unstubAllGlobals();
});

describe("HomeForm", () => {
  it("shows name error when hosting with blank name", async () => {
    const fetchFn = mockFetch(201, { code: "K7PQ" });
    render(<HomeForm />);
    await userEvent.click(screen.getByRole("button", { name: "Host a room" }));
    expect(screen.getByText("Enter a name (1–12 characters).")).toBeInTheDocument();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("shows code error when joining without a code", async () => {
    const fetchFn = mockFetch(200, { code: "K7PQ" });
    render(<HomeForm />);
    await userEvent.type(screen.getByLabelText("Your name"), "Ash");
    await userEvent.click(screen.getByRole("button", { name: "Join room" }));
    expect(screen.getByText("Enter a 4-character room code.")).toBeInTheDocument();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('shows "Room not found." for a 4-character code with excluded characters', async () => {
    const fetchFn = mockFetch(200, { code: "K7PQ" });
    render(<HomeForm />);
    await userEvent.type(screen.getByLabelText("Your name"), "Ash");
    await userEvent.type(screen.getByLabelText("Room code"), "K0PQ");
    await userEvent.click(screen.getByRole("button", { name: "Join room" }));
    expect(screen.getByText("Room not found.")).toBeInTheDocument();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("joins when Enter is pressed in the code field", async () => {
    const fetchFn = mockFetch(200, { code: "K7PQ" });
    render(<HomeForm />);
    await userEvent.type(screen.getByLabelText("Your name"), "Ash");
    await userEvent.type(screen.getByLabelText("Room code"), "k7pq{Enter}");
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/room/K7PQ"));
    expect(fetchFn).toHaveBeenCalledWith("/api/rooms/K7PQ/join", expect.anything());
  });

  it('shows "Room is full." from a 409', async () => {
    mockFetch(409, { error: "Room is full." });
    render(<HomeForm />);
    await userEvent.type(screen.getByLabelText("Your name"), "Ash");
    await userEvent.type(screen.getByLabelText("Room code"), "k7pq");
    await userEvent.click(screen.getByRole("button", { name: "Join room" }));
    expect(await screen.findByText("Room is full.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("navigates to /room/K7PQ after hosting", async () => {
    mockFetch(201, { code: "K7PQ" });
    render(<HomeForm />);
    await userEvent.type(screen.getByLabelText("Your name"), "Ash");
    await userEvent.click(screen.getByRole("button", { name: "Host a room" }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/room/K7PQ"));
  });

  it("renders initialError", () => {
    render(<HomeForm initialError="Room not found." />);
    expect(screen.getByText("Room not found.")).toBeInTheDocument();
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
    await userEvent.type(screen.getByLabelText("Your name"), "Ash");
    await userEvent.click(screen.getByRole("button", { name: "Host a room" }));
    await vi.waitFor(() => expect(push).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Host a room" })).toBeDisabled();
    rerender(ui("hidden"));
    rerender(ui("visible"));
    expect(screen.getByRole("button", { name: "Host a room" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Join room" })).toBeEnabled();
  });

  it("shows a changed initialError", () => {
    const { rerender } = render(<HomeForm />);
    rerender(<HomeForm initialError="Room not found." />);
    expect(screen.getByText("Room not found.")).toBeInTheDocument();
  });
});
