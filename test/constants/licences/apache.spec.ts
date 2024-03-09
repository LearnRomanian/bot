import { expect } from "chai";
import apache from "../../../src/constants/licences/apache";

const NOTICE = "this-is-a-sample-passed-copyright-notice";

describe("The generator generates", () => {
	it("parts of the Apache licence that are each no more than 1024 characters long.", () => {
		const parts = apache(NOTICE);
		for (const part of parts) {
			expect(part.length).to.be.lessThanOrEqual(1024);
		}
	});

	it("at least one part containing the passed copyright notice.", () => {
		const parts = apache(NOTICE);
		expect(parts.some((part) => part.includes(NOTICE))).to.be.true;
	});

	it("an array that is immutable.", () => {
		const parts = apache(NOTICE);
		expect(Object.isFrozen(parts)).to.be.true;
	});
});
