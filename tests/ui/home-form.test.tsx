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
