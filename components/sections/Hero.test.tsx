import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { REWRITES } from "@/components/swarm/choreographies";
import { Hero } from "./Hero";

describe("Hero", () => {
  // The type effect finds the word with indexOf, so a title without it just
  // stops stumbling, with no error anywhere.
  it("keeps the word the crew stumbles on in the title", () => {
    render(<Hero />);
    const title = screen.getByRole("heading", { level: 1 }).textContent;
    for (const word of Object.keys(REWRITES)) expect(title).toContain(word);
  });
});
