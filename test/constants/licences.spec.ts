import { expect } from "chai";
import licences from "../../src/constants/licences";

describe("The licences object", () => {
	it("is immutable.", () => {
		expect(Object.isFrozen(licences)).to.be.true;
	});
});

describe("isValidDictionary()", () => {
	// TODO(vxern): Test.
});

describe("getDictionaryLicenceByDictionary()", () => {
	// TODO(vxern): Test.
});
