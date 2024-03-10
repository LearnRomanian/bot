import { Cache } from "../../src/lib/cache";
import { expect } from "chai";

describe("Cache", () => {
	describe("constructor()", () => {
		it("creates an object.", () => {
			expect(() => new Cache()).to.not.throw;
		});
	});

	describe("start()", () => {
		it("opens a connection to Redis.", () => {
			// TODO(vxern): Test this.
		});
	});

	describe("stop()", () => {
		it("closes the connection to Redis.", () => {
			// TODO(vxern): Test this.
		});
	});
});
