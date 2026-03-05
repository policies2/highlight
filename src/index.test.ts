import { describe, expect, it } from "bun:test";
import { type ColorMap, highlightText } from "./index";

const colors: ColorMap = {
	number: "c-number",
	date: "c-date",
	object: "c-object",
	comment: "c-comment",
	selector: "c-selector",
	function: "c-function",
	reference: "c-reference",
	referenced: "c-referenced",
	label: "c-label",
	labelReference: "c-label-ref",
	false: "c-false",
	true: "c-true",
	string: "c-string",
	optional: "c-optional",
};

const hl = (text: string) => highlightText(text, colors);

describe("highlightText", () => {
	it("should escape HTML special characters", () => {
		const result = hl("<script>alert('test')</script> & <div>");
		expect(result).toContain("&lt;script&gt;");
		expect(result).toContain("&amp;");
		expect(result).not.toContain("<script>");
	});

	it("should highlight numbers", () => {
		const result = hl("The age is 25 and the score is 100");
		expect(result).toContain(`<span class="c-number">25</span>`);
		expect(result).toContain(`<span class="c-number">100</span>`);
	});

	it("should highlight dates with dateColor instead of numberColor", () => {
		const result = hl("The date is 2008-12-12 and date(2025-06-11)");
		expect(result).toContain(`<span class="c-date">2008-12-12</span>`);
		expect(result).toContain(`<span class="c-date">date(2025-06-11)</span>`);
		expect(result).not.toContain(`<span class="c-number">2008</span>`);
	});

	it("should highlight comparison phrases", () => {
		const result = hl("The age is greater than 18 and is less than 65");
		expect(result).toContain(`<span class="c-function">is greater than</span>`);
		expect(result).toContain(`<span class="c-function">is less than</span>`);
	});

	it("should highlight double asterisk objects", () => {
		const result = hl("A **Person** has an age");
		expect(result).toContain(`<span class="c-object">**Person**</span>`);
	});

	it("should highlight double underscore selectors", () => {
		const result = hl("The __age__ is equal to 25");
		expect(result).toContain(`<span class="c-selector">__age__</span>`);
	});

	it("should highlight labels at the start of lines", () => {
		const result = hl("rule1. A **Person** has an age");
		expect(result).toContain(`<span class="c-label">rule1.</span>`);
	});

	it("should highlight booleans", () => {
		const result = hl("the value is true or false");
		expect(result).toContain(`<span class="c-true">true</span>`);
		expect(result).toContain(`<span class="c-false">false</span>`);
	});

	it("should highlight string literals", () => {
		const result = hl('is equal to "hello"');
		expect(result).toContain(`<span class="c-string">"hello"</span>`);
	});

	describe("comments", () => {
		it("should highlight comments starting with #", () => {
			const result = hl("# This is a comment\nNot a comment");
			expect(result).toContain(`<span class="c-comment"># This is a comment</span>`);
		});

		it("should not process numbers inside comments", () => {
			const result = hl("# 32 days in seconds");
			expect(result).toContain(`<span class="c-comment"># 32 days in seconds</span>`);
			expect(result).not.toContain(`<span class="c-number">32</span>`);
		});
	});

	describe("rule references", () => {
		it("should highlight referenced rules", () => {
			const input = `A **Person** passes the practical driving test
A **Person** gets a full driving license if the **Person** passes the practical driving test`;
			const result = hl(input);
			expect(result).toContain(`<span class="c-referenced">passes the practical driving test</span>`);
			expect(result).toContain(`<span class="c-reference">passes the practical driving test</span>`);
		});

		it("should not highlight unreferenced rules", () => {
			const result = hl("A **Person** has a birthday");
			expect(result).not.toContain(`<span class="c-referenced">has a birthday</span>`);
			expect(result).not.toContain(`<span class="c-reference">has a birthday</span>`);
		});
	});

	describe("label references", () => {
		it("should highlight label references (§label)", () => {
			const input = `driver. A **driver** passes the age test
A **driver** gets a driving licence if §driver passes`;
			const result = hl(input);
			expect(result).toContain(`<span class="c-label-ref">§driver passes</span>`);
		});

		it("should support $ as alternative to §", () => {
			const input = `driver. A **driver** passes the age test
A **driver** gets a licence if $driver passes`;
			const result = hl(input);
			expect(result).toContain(`<span class="c-label-ref">$driver passes</span>`);
		});
	});

	describe("optional markers", () => {
		it("should highlight -and and -or", () => {
			const input = "  -and the __age__ is at least 18";
			const result = hl(input);
			expect(result).toContain(`<span class="c-optional">-and</span>`);
		});
	});

	describe("quantifier operators", () => {
		it("should highlight 'any' keyword", () => {
			const result = hl("any __scores__ of the **student** is greater than 80");
			expect(result).toContain(`<span class="c-function">any</span>`);
		});

		it("should highlight 'all' keyword", () => {
			const result = hl("all __amounts__ of the **Order** is greater than 0");
			expect(result).toContain(`<span class="c-function">all</span>`);
		});
	});

	describe("compound predicates", () => {
		it("should highlight 'where' before parenthesis", () => {
			const result = hl(`any __grants__ of the **request** where (its __action__ is equal to "read")`);
			expect(result).toContain(`<span class="c-function">where </span>`);
		});

		it("should highlight 'satisfies' before parenthesis", () => {
			const result = hl(`any __grants__ of the **request** satisfies (its __action__ is equal to "read")`);
			expect(result).toContain(`<span class="c-function">satisfies </span>`);
		});

		it("should highlight 'its' keyword", () => {
			const result = hl(`where (its __action__ is equal to "read" and its __type__ is equal to "dog")`);
			const itsMatches = result.match(/<span class="c-function">its<\/span>/g);
			expect(itsMatches).toHaveLength(2);
		});
	});

	describe("dynamic key lookup", () => {
		it("should highlight 'looked up in'", () => {
			const result = hl("__user__ of the **request** looked up in **user_roles**");
			expect(result).toContain(`<span class="c-function">looked up in</span>`);
		});

		it("should highlight 'resolved through'", () => {
			const result = hl("__user__ of the **request** resolved through **user_roles**");
			expect(result).toContain(`<span class="c-function">resolved through</span>`);
		});

		it("should highlight chained lookups", () => {
			const result = hl("__user__ of the **request** looked up in **user_roles** looked up in **role_grants**");
			const matches = result.match(/<span class="c-function">looked up in<\/span>/g);
			expect(matches).toHaveLength(2);
		});
	});

	describe("full complex expression", () => {
		it("should highlight all new syntax together", () => {
			const input = `any __user__ of the **request** looked up in **user_roles** looked up in **role_grants**
   where (its __action__ is equal to the __action__ of the **request**
   and its __type__ is equal to the __type__ of the **request**)`;
			const result = hl(input);

			expect(result).toContain(`<span class="c-function">any</span>`);
			expect(result).toContain(`<span class="c-function">looked up in</span>`);
			expect(result).toContain(`<span class="c-function">where </span>`);
			expect(result).toContain(`<span class="c-function">its</span>`);
			expect(result).toContain(`<span class="c-function">is equal to</span>`);
			expect(result).toContain(`<span class="c-object">**request**</span>`);
			expect(result).toContain(`<span class="c-selector">__user__</span>`);
			expect(result).toContain(`<span class="c-selector">__action__</span>`);
		});
	});

	it("should preserve line breaks", () => {
		const result = hl("Line 1\nLine 2\nLine 3");
		expect(result.split("\n")).toHaveLength(3);
	});

	it("should handle empty input", () => {
		expect(hl("")).toBe("");
	});

	it("should handle all comparison phrases", () => {
		const phrases = [
			"is greater than or equal to",
			"is at least",
			"is less than or equal to",
			"is no more than",
			"is equal to",
			"is exactly equal to",
			"is the same as",
			"is not equal to",
			"is later than",
			"is greater than",
			"is less than",
			"is in",
			"is not in",
			"is within",
			"contains",
			"looked up in",
			"resolved through",
			"starts with",
			"ends with",
			"is between",
			"is in the past",
			"is in the future",
			"is empty",
			"is not empty",
			"exists",
			"does not exist",
		];

		for (const phrase of phrases) {
			const result = hl(`The value ${phrase} something`);
			expect(result).toContain(`<span class="c-function">${phrase}</span>`);
		}
	});
});
