"use strict";

const base = require("../base.js");
const assert = require("chai").assert;

describe("authentication plugin", () => {
  it("ed25519 authentication plugin", function(done) {
    if (!shareConn.isMariaDB() || !shareConn.hasMinVersion(10, 1, 22)) this.skip();
    shareConn.query("INSTALL PLUGIN client_ed25519 SONAME 'auth_ed25519'", err => {
      if (err) this.skip();
      shareConn.query("drop user verificationEd25519AuthPlugin@'%'", err => {});
      shareConn.query(
        "CREATE USER verificationEd25519AuthPlugin@'%' IDENTIFIED " +
          "VIA ed25519 USING 'ZIgUREUg5PVgQ6LskhXmO+eZLS0nC8be6HPjYWR4YJY'"
      );
      shareConn.query("GRANT ALL on *.* to verificationEd25519AuthPlugin@'%'");
      const conn = base.createConnection({
        user: "verificationEd25519AuthPlugin",
        password: "secret"
      });
      conn.connect(function(err) {
        if (err) {
          const expectedMsg = err.message.includes(
            "Client does not support authentication protocol 'client_ed25519' requested by server."
          );
          if (!expectedMsg) console.log(err);
          assert.isTrue(expectedMsg);
          done();
        } else {
          done(new Error("must have throw an error"));
        }
      });
    });
  });

  it("name pipe authentication plugin", function(done) {
    if (process.platform !== "win32") this.skip();
    if (!shareConn.isMariaDB() || !shareConn.hasMinVersion(10, 1, 11)) this.skip();
    if (shareConn.opts.host !== "localhost" && shareConn.opts.host !== "mariadb.example.com")
      this.skip();
    const windowsUser = process.env.USERNAME;
    if (windowsUser === "root") this.skip();

    shareConn.query("INSTALL PLUGIN named_pipe SONAME 'auth_named_pipe'", err => {});
    shareConn.query("DROP USER " + windowsUser);
    shareConn.query("CREATE USER " + windowsUser + " IDENTIFIED VIA named_pipe using 'test'");
    shareConn.query("GRANT ALL on *.* to " + windowsUser);

    shareConn.query("select @@version_compile_os,@@socket soc", (err, res) => {
      const conn = base.createConnection({ user: null, socketPath: "\\\\.\\pipe\\" + res[0].soc });
      conn.connect(function(err) {
        if (err) return done(err);
        conn.end();
        done();
      });
    });
  });

  it("unix socket authentication plugin", function(done) {
    if (process.platform === "win32") this.skip();
    if (!shareConn.isMariaDB() || !shareConn.hasMinVersion(10, 1, 11)) this.skip();
    if (process.env.MUST_USE_TCPIP) this.skip();
    if (shareConn.opts.host !== "localhost" && shareConn.opts.host !== "mariadb.example.com")
      this.skip();

    shareConn.query("select @@version_compile_os,@@socket soc", (err, res) => {
      const unixUser = process.env.USERNAME;
      if (unixUser === "root") this.skip();

      shareConn.query("INSTALL PLUGIN unix_socket SONAME 'auth_socket'");
      shareConn.query("DROP USER " + unixUser);
      shareConn.query("CREATE USER " + unixUser + " IDENTIFIED VIA unix_socket using 'test'");
      shareConn.query("GRANT ALL on *.* to " + unixUser);
      const conn = base.createConnection({ user: null, socketPath: res[0].soc });
      conn.connect(function(err) {
        if (err) return done(err);
        conn.end();
        done();
      });
    });
  });

  it("dialog authentication plugin", function(done) {
    //pam is set using .travis/entrypoint/pam.sh
    if (!process.env.TRAVIS) this.skip();
    if (!shareConn.isMariaDB()) this.skip();
    this.timeout(10000);
    shareConn.query("INSTALL PLUGIN pam SONAME 'auth_pam'");
    shareConn.query("CREATE USER 'testPam'@'%' IDENTIFIED VIA pam USING 'mariadb'");
    shareConn.query("GRANT ALL ON *.* TO 'testPam'@'%' IDENTIFIED VIA pam");

    //password is unix password "myPwd"
    const conn = base.createConnection({ user: "testPam", password: "myPwd" });
    conn.connect(function(err) {
      if (err) return done(err);
      conn.end();
      done();
    });
  });
});