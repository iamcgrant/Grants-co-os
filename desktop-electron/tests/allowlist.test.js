"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  isExactAllowedHost,
  classifyNavigation,
  hostnameOf,
  isSafeExternalHttps,
} = require("../src/main/allowlist");

describe("exact hostname allowlist", () => {
  const hosts = ["app.gohighlevel.com"];

  it("allows only the exact hostname", () => {
    assert.equal(isExactAllowedHost("app.gohighlevel.com", hosts), true);
    assert.equal(isExactAllowedHost("APP.gohighlevel.com", hosts), true);
  });

  it("rejects parent, sibling, suffix, and lookalike hosts", () => {
    assert.equal(isExactAllowedHost("gohighlevel.com", hosts), false);
    assert.equal(isExactAllowedHost("www.gohighlevel.com", hosts), false);
    assert.equal(isExactAllowedHost("evil.app.gohighlevel.com", hosts), false);
    assert.equal(isExactAllowedHost("app.gohighlevel.com.evil.example", hosts), false);
    assert.equal(isExactAllowedHost("notgohighlevel.com", hosts), false);
  });

  it("rejects empty or missing hostnames", () => {
    assert.equal(isExactAllowedHost("", hosts), false);
    assert.equal(isExactAllowedHost(null, hosts), false);
  });
});

describe("classifyNavigation", () => {
  const hosts = ["pulse.disputeprocess.com"];

  it("allows https on an exact allowlisted host", () => {
    const decision = classifyNavigation(
      "https://pulse.disputeprocess.com/jsp/client/login.jsp",
      hosts,
    );
    assert.equal(decision.action, "allow");
    assert.equal(decision.host, "pulse.disputeprocess.com");
  });

  it("sends unknown https hosts to the system-browser path", () => {
    const decision = classifyNavigation("https://accounts.google.com/o/oauth", hosts);
    assert.equal(decision.action, "system-browser");
    assert.equal(decision.reason, "host-not-allowlisted");
    assert.equal(decision.host, "accounts.google.com");
  });

  it("blocks non-https and invalid URLs", () => {
    assert.equal(classifyNavigation("http://pulse.disputeprocess.com/", hosts).action, "block");
    assert.equal(classifyNavigation("javascript:alert(1)", hosts).action, "block");
    assert.equal(classifyNavigation("grantscoos://inbox", hosts).action, "block");
    assert.equal(classifyNavigation("not a url", hosts).action, "block");
  });
});

describe("url helpers", () => {
  it("reads hostnames and only treats https as safe external", () => {
    assert.equal(hostnameOf("https://os.grantandconsultants.com/home"), "os.grantandconsultants.com");
    assert.equal(isSafeExternalHttps("https://os.grantandconsultants.com/"), true);
    assert.equal(isSafeExternalHttps("http://os.grantandconsultants.com/"), false);
    assert.equal(isSafeExternalHttps("file:///tmp/x"), false);
  });
});
