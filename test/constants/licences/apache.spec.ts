import apache from "../../../src/constants/licences/apache";

const NOTICE = "this-is-a-sample-passed-copyright-notice";

describe("The generator generates", () => {
	it("parts of the Apache licence that are each no more than 1024 characters long.", () => {
		const parts = apache(NOTICE);
		expect(parts.every((part) => part.length <= 1024)).toBe(true);
	});

	it("at least one part containing the passed copyright notice.", () => {
		const parts = apache(NOTICE);
		expect(parts.some((part) => part.includes(NOTICE))).toBe(true);
	});

	it("an array that is immutable.", () => {
		const parts = apache(NOTICE);
		expect(Object.isFrozen(parts)).toBe(true);
	});
});
