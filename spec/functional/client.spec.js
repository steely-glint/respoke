var helpers = require('../util/helpers.js');
var Client = helpers.Client;
var expect = require('chai').expect;
var fixtureDriver;

var clientName = 'client1';
var username;
var username2;
var password = 'password';
var env;

describe("client", function () {

    this.timeout(30000);

    before(function (done) {
        helpers.testFixtureBeforeTest({randomUserNames: 2}, function (d, environment) {
            fixtureDriver = d;
            env = environment;
            username = env.users[0].username;
            username2 = env.users[1].username;
            done();
        });
    });

    describe("Connection", function () {
        var driver;
        var client;

        beforeEach(function (done) {
            driver = helpers.webDriver();
            client = new Client(driver, clientName);
            driver.get(process.env['MERCURY_URL'] + '/index.html');
            client.init(env.appId).then(done);
        });

        afterEach(function (done) {
            driver.quit();
            done();
        });

        it("not connected", function (done) {
            client.isConnected().then(function (result) {
                expect(result).to.equal(false);
                done();
            });
        });

        it("connected", function (done) {
            client.connect();
            client.isConnected().then(function (result) {
                expect(result).to.equal(true);
                done();
            });
        });

        it("disconnected", function (done) {
            client.connect();
            client.disconnect();
            client.isConnected().then(function (result) {
                expect(result).to.equal(false);
                done();
            });
        });
    });

    describe("Authentication", function () {
        var driver;
        var client;

        beforeEach(function (done) {
            driver = helpers.webDriver();
            client = new Client(driver, clientName);
            driver.get(process.env['MERCURY_URL'] + '/index.html');
            client.init(env.appId);
            client.connect().then(done);
        });

        afterEach(function (done) {
            driver.quit();
            done();
        });

        it("not authenticated", function () {
            client.isLoggedIn().then(function (result) {
                expect(result).to.equal(false);
            });
        });

        it("login", function (done) {
            client.login(username, password);
            client.isLoggedIn().then(function (result) {
                expect(result).to.equal(true);
                client.logout().then(done);
            });
        });

        //no longer valid spec, but may become so in the future once the design
        //decision is made on callbacks vs exceptions
        xit("should call error function when given wrong credentials", function (done) {
            var login = driver.executeAsyncScript("var callback = arguments[arguments.length - 1]; " +
                "var userPromise = window['" + clientName + "'].login('" + username + "', 'badpassword'); " +
                "userPromise.then(function (user) { }, function (error) { " +
                "    callback(error);" +
                "});");
            login.then(function (error) {
                expect(error).to.exist;
                done();
            });
        });

        it("logout", function (done) {
            client.login(username, password);
            client.isLoggedIn().then(function (result) {
                expect(result).to.equal(true);
            });
            client.logout();
            client.isLoggedIn().then(function (result) {
                expect(result).to.equal(false);
                done();
            });
        });

        // after logging out client can't login again
        xit("should login / logout / login", function (done) {
            client.login(username, password);
            client.isLoggedIn().then(function (result) {
                expect(result).to.equal(true)
            });
            client.logout();
            client.isLoggedIn().then(function (result) {
                expect(result).to.equal(false);
            });
            // client = new Client(driver, clientName + '2');
            // client.init(env.appId);
            // client.connect();
            client.login(username, password);
            client.isLoggedIn().then(function (result) {
                console.log(result);
                expect(result).to.equal(true);
                done();
            });
        });

        xit("should logout twice after login with no side effects", function (done) {
            client.login(username, password);
            client.isLoggedIn().then(function (result) {
                expect(result).to.equal(true);
            });
            client.logout();
            client.isLoggedIn().then(function (result) {
                expect(result).to.equal(false);
            });
            client.logout();
            client.isLoggedIn().then(function (result) {
                expect(result).to.equal(false);
                done();
            });
        });

        // after logging out can't login again
        xit("should login user 1, logout user1, and login user2", function (done) {
            client.login(username, password);
            client.isLoggedIn().then(function (result) {
                expect(result).to.equal(true);
            });
            client.logout();
            client.isLoggedIn().then(function (result) {
                expect(result).to.equal(false);
            });
            // client = new Client(driver, clientName + '3');
            // client.init(env.appId);
            // client.connect();
            client.login(username2, password);
            client.isLoggedIn().then(function (result) {
                console.log(result);
                expect(result).to.equal(true);
                done();
            });
        });

        it("should login user twice", function (done) {
            client.login(username, password);
            client.isLoggedIn().then(function (result) {
                expect(result).to.equal(true);
            });
            client.login(username, password);
            client.isLoggedIn().then(function (result) {
                expect(result).to.equal(true);
                done();
            });
        });
    });


    describe("settings", function () {
        var driver;
        var client;
        var indexPromise;

        beforeEach(function (done) {
            driver = helpers.webDriver();
            client = new Client(driver, clientName);
            indexPromise = driver.get(process.env['MERCURY_URL'] + '/index.html');
            indexPromise.then(function () {
                client.init(env.appId);
                client.connect();
                client.login(username, password).then(function () {
                    done();
                });
            });
        });

        afterEach(function (done) {
            driver.quit();
            done();
        });

        it("getClientSettings should have appId", function () {
            indexPromise.then(function () {
                client.getClientSettings().then(function (clientSettings) {
                    expect(clientSettings.appId).to.exist;
                    expect(clientSettings.appId).to.equal(env.appId);
                });
            });
        });

        it("CallSettings should have callSettings", function () {
            client.getCallSettings().then(function (callSettings) {
                expect(callSettings).to.exist;
                expect(callSettings.constraints).to.exist;
            });
        });

        it("getSignalingChannel should have a signaling channel", function () {
            client.getSignalingChannel().then(function (signalingChannel) {
                expect(signalingChannel).to.exist;
            });
        });
    });

    after(function (done) {
        helpers.testFixtureAfterTest(fixtureDriver, done);
    });
});
