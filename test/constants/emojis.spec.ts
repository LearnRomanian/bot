import { expect } from "chai";
import emojis from "../../src/constants/emojis";

describe("The emojis object", () => {
	it("is immutable.", () => {
		expect(Object.isFrozen(emojis)).to.be.true;
	});
});

describe("getEmojiBySongListingType()", () => {
	// TODO(vxern): Add tests.
});
