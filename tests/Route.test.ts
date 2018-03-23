import { Route } from '../src/Route';
import { iMiddleware } from '../src/middlewares/iMiddleware';
import { expect, assert, use, spy } from 'chai';
import * as spies from 'chai-spies';
import * as http from 'http';
var MockReq = require('mock-req');
import 'mocha';

use(spies);

describe('Route', () => {
    // Route object used for testing
    const helloRoute = new Route();

    // Routes to add for testing
    const randomRoute = '/random';
    const newRoute = '/newRoute';
    const exceptionRoute = '/exception';

    let simpleRouteFunction = (req, res) => { };
    let middleware: iMiddleware = {
        alter: (req, res) => {
            return true;
        }
    };

    describe('Constructor', () => {
        it('should contain empty middleware', () => {
            assert.isArray(helloRoute.middleware, 'Middleware is not an array');
            expect(helloRoute.middleware.length).to.equal(0, 'Middleware count != 0');
        });

        it('should contain empty nextRoute object', () => {
            assert.isObject(helloRoute.nextRoute);
            expect(Object.keys(helloRoute.nextRoute).length).to.equal(0, 'NextRoute has keys');
        });
    });

    describe('removeTrailingSlash', () => {
        it('should remove trailing slash', () => {
            expect(Route.removeTrailingSlash('/users/')).to.equal('/users');
            expect(Route.removeTrailingSlash('/users/foobar/')).to.equal('/users/foobar');
            expect(Route.removeTrailingSlash('/')).to.equal('');
        });

        it('should not remove anything', () => {
            expect(Route.removeTrailingSlash('/users')).to.equal('/users');
            expect(Route.removeTrailingSlash('/users/foobar')).to.equal('/users/foobar');
            expect(Route.removeTrailingSlash('')).to.equal('');
        });
    });

    describe('removeSlashFromFront', () => {
        it('should remove starting slash', () => {
            expect(Route.removeSlashFromFront('/users')).to.equal('users');
            expect(Route.removeSlashFromFront('/users/')).to.equal('users/');
            expect(Route.removeSlashFromFront('/users/foobar/')).to.equal('users/foobar/');
            expect(Route.removeSlashFromFront('/')).to.equal('');
        });

        it('should not remove anything', () => {
            expect(Route.removeSlashFromFront('users/')).to.equal('users/');
            expect(Route.removeSlashFromFront('users/foobar')).to.equal('users/foobar');
            expect(Route.removeSlashFromFront('')).to.equal('');
        });
    });

    describe('fixRequestUrlForAdding', () => {
        it('should remove slashes', () => {
            expect(Route.fixRequestUrlForAdding('/users/')).to.equal('users');
            expect(Route.fixRequestUrlForAdding('/users/foobar/')).to.equal('users/foobar');
            expect(Route.fixRequestUrlForAdding('/')).to.equal('');
        });

        it('should not remove anything', () => {
            expect(Route.fixRequestUrlForAdding('users')).to.equal('users');
            expect(Route.fixRequestUrlForAdding('users/foobar')).to.equal('users/foobar');
            expect(Route.fixRequestUrlForAdding('')).to.equal('');
        });
    });

    describe('Use', () => {
        it('should add middleware', () => {
            assert.equal(helloRoute.middleware.length, 0);
            helloRoute.use(middleware);
            assert.equal(helloRoute.middleware.length, 1);
        });
    });

    describe('Adding routes', () => {
        it('should add get route', () => {
            assert.isUndefined(helloRoute.getFunction);
            helloRoute.get(randomRoute, simpleRouteFunction);
            helloRoute.get(newRoute, simpleRouteFunction);
            assert.isUndefined(helloRoute.getFunction);

            helloRoute.get('/', simpleRouteFunction);

            assert.hasAllKeys(helloRoute.nextRoute, ['random', 'newRoute'], 'Random route not added');
            assert.isFunction(helloRoute.getFunction);

            assert.isFunction(helloRoute.nextRoute.random.getFunction);
            console.log(helloRoute.nextRoute.random.getFunction);
            assert.isFunction(helloRoute.nextRoute.newRoute.getFunction);
        });

        it('should add post route', () => {
            assert.isUndefined(helloRoute.postFunction);
            helloRoute.post(randomRoute, simpleRouteFunction);
            helloRoute.post(newRoute, simpleRouteFunction);
            assert.isUndefined(helloRoute.postFunction);

            helloRoute.post('/', simpleRouteFunction);

            assert.hasAllKeys(helloRoute.nextRoute, ['random', 'newRoute'], 'Random route not added');
            assert.isFunction(helloRoute.postFunction);

            assert.isFunction(helloRoute.nextRoute.random.postFunction);
            assert.isFunction(helloRoute.nextRoute.newRoute.postFunction);
        });

        it('should add put route', () => {
            assert.isUndefined(helloRoute.putFunction);
            helloRoute.put(randomRoute, simpleRouteFunction);
            helloRoute.put(newRoute, simpleRouteFunction);
            assert.isUndefined(helloRoute.putFunction);

            helloRoute.put('/', simpleRouteFunction);

            assert.hasAllKeys(helloRoute.nextRoute, ['random', 'newRoute'], 'Random route not added');
            assert.isFunction(helloRoute.putFunction);

            assert.isFunction(helloRoute.nextRoute.random.putFunction);
            assert.isFunction(helloRoute.nextRoute.newRoute.putFunction);
        });

        it('should add delete route', () => {
            assert.isUndefined(helloRoute.deleteFunction);
            helloRoute.delete(randomRoute, simpleRouteFunction);
            helloRoute.delete(newRoute, simpleRouteFunction);
            assert.isUndefined(helloRoute.deleteFunction);

            helloRoute.delete('/', simpleRouteFunction);

            assert.hasAllKeys(helloRoute.nextRoute, ['random', 'newRoute'], 'Random route not added');
            assert.isFunction(helloRoute.deleteFunction);

            assert.isFunction(helloRoute.nextRoute.random.deleteFunction);
            assert.isFunction(helloRoute.nextRoute.newRoute.deleteFunction);
        });
    });

    describe('Parse', () => {
        it('Should match route', () => {
            assert.isTrue(helloRoute.parse({ url: randomRoute }, new MockReq({ method: 'GET' }), null));
            assert.isTrue(helloRoute.parse({ url: randomRoute }, new MockReq({ method: 'PUT' }), null));
            assert.isTrue(helloRoute.parse({ url: randomRoute }, new MockReq({ method: 'POST' }), null));
            assert.isTrue(helloRoute.parse({ url: randomRoute }, new MockReq({ method: 'DELETE' }), null));

            assert.isTrue(helloRoute.parse({ url: newRoute }, new MockReq({ method: 'GET' }), null));
            assert.isTrue(helloRoute.parse({ url: newRoute }, new MockReq({ method: 'PUT' }), null));
            assert.isTrue(helloRoute.parse({ url: newRoute }, new MockReq({ method: 'POST' }), null));
            assert.isTrue(helloRoute.parse({ url: newRoute }, new MockReq({ method: 'DELETE' }), null));
        });

        it('should match route without slash', () => {
            assert.isTrue(helloRoute.parse({ url: randomRoute + '/' }, new MockReq({ method: 'GET' }), null));
            assert.isTrue(helloRoute.parse({ url: randomRoute.substring(1) + '/' }, new MockReq({ method: 'GET' }), null));
            assert.isTrue(helloRoute.parse({ url: randomRoute.substring(1) }, new MockReq({ method: 'GET' }), null));
        });

        it('should match and call function', () => {
            let inc = 1;
            function getMatchRoot(req, res) { }
            function getMatchRootId(req, res, id) { assert.isTrue(id === inc.toString()); ++inc; }

            let spyFunctionRoot = spy(getMatchRoot);
            let spyFunctionRootId = spy(getMatchRootId);

            helloRoute.get('/spy', spyFunctionRoot);
            helloRoute.get('/spy/:id', spyFunctionRootId);
            helloRoute.get('/spy/:id/hello', spyFunctionRootId);
            helloRoute.get('/spy/:id/hello/world', spyFunctionRootId);

            assert.isTrue(helloRoute.parse({ url: '/spy' }, new MockReq({ method: 'GET' }), null));

            assert.isTrue(helloRoute.parse({ url: '/spy/1' }, new MockReq({ method: 'GET' }), null));
            assert.isTrue(helloRoute.parse({ url: '/spy/2' }, new MockReq({ method: 'GET' }), null));

            expect(spyFunctionRoot).to.have.been.called.exactly(1);
            expect(spyFunctionRootId).to.have.been.called.exactly(2);
        });

        it('should call correct http-method', () => {
            let getMethod = spy((req) => { assert.isTrue(req.method === 'GET'); });
            let putMethod = spy((req) => { assert.isTrue(req.method === 'PUT'); });
            let postMethod = spy((req) => { assert.isTrue(req.method === 'POST'); });
            let deleteMethod = spy((req) => { assert.isTrue(req.method === 'DELETE'); });

            helloRoute.get('/hello-world', getMethod);
            helloRoute.put('/hello-world', putMethod);
            helloRoute.post('/hello-world', postMethod);
            helloRoute.delete('/hello-world', deleteMethod);

            assert.isTrue(helloRoute.parse({ url: '/hello-world' }, new MockReq({ method: 'GET' }), null));
            assert.isTrue(helloRoute.parse({ url: '/hello-world' }, new MockReq({ method: 'PUT' }), null));
            assert.isTrue(helloRoute.parse({ url: '/hello-world' }, new MockReq({ method: 'POST' }), null));

            assert.isTrue(helloRoute.parse({ url: '/hello-world' }, new MockReq({ method: 'DELETE' }), null));

            expect(getMethod).to.have.been.called.exactly(1);
            expect(putMethod).to.have.been.called.exactly(1);
            expect(postMethod).to.have.been.called.exactly(1);
            expect(deleteMethod).to.have.been.called.exactly(1);
        });

        it('should call http-method with `world` as input parameter', () => {
            let getMethod = spy((req, res, name) => {
                assert.isTrue(req.method === 'GET');
                assert.isTrue(name === 'world-get');
            });

            let putMethod = spy((req, res, name) => {
                assert.isTrue(req.method === 'PUT');
                assert.isTrue(name === 'world-put');
            });

            let postMethod = spy((req, res, name) => {
                assert.isTrue(req.method === 'POST');
                assert.isTrue(name === 'world-post');
            });

            let deleteMethod = spy((req, res, name) => {
                assert.isTrue(req.method === 'DELETE');
                assert.isTrue(name === 'world-delete');
            });

            helloRoute.get('/hello-world/:name', getMethod);
            helloRoute.put('/hello-world/:name', putMethod);
            helloRoute.post('/hello-world/:name', postMethod);
            helloRoute.delete('/hello-world/:name', deleteMethod);

            assert.isTrue(helloRoute.parse({ url: '/hello-world/world-get' }, new MockReq({ method: 'GET' }), null));
            assert.isTrue(helloRoute.parse({ url: '/hello-world/world-put' }, new MockReq({ method: 'PUT' }), null));
            assert.isTrue(helloRoute.parse({ url: '/hello-world/world-post' }, new MockReq({ method: 'POST' }), null));
            assert.isTrue(helloRoute.parse({ url: '/hello-world/world-delete' }, new MockReq({ method: 'DELETE' }), null));

            expect(getMethod).to.have.been.called.exactly(1);
            expect(putMethod).to.have.been.called.exactly(1);
            expect(postMethod).to.have.been.called.exactly(1);
            expect(deleteMethod).to.have.been.called.exactly(1);
        });

        it('should throw Error', () => {
            // TODO: create new route with no post route defined
            expect(() => helloRoute.parse({ url: 'spy' }, new MockReq({ method: 'POST' }), null)).to.throw();
        });

    });

    describe('Sub-routing', () => {

        it('should add a sub-route with no route-name', () => {
            let parentRoute = new Route();

            parentRoute.get('/one-get', () => { });
            parentRoute.get('/two-get', () => { });
            parentRoute.put('/one-put', () => { });
            parentRoute.post('/one-post', () => { });
            parentRoute.delete('/one-delete', () => { });

            let subRoute = new Route();
            subRoute.get('/sub-one-get', () => { });
            subRoute.get('/sub-one-get/hello', () => { });
            subRoute.get('/sub-two-get', () => { });
            subRoute.put('/sub-one-put', () => { });
            subRoute.post('/sub-one-post', () => { });
            subRoute.delete('/sub-one-delete', () => { });

            let otherSub = new Route();
            otherSub.get('/test', () => { });
            otherSub.get('/my-test-sub', () => { });
            otherSub.get('/my-other-sub', () => { });

            parentRoute.add('sub', subRoute);
            parentRoute.add('sub-one-get', otherSub);

            assert.hasAnyKeys(parentRoute.nextRoute, ['sub'], 'Sub route not added');
            assert.hasAnyKeys(parentRoute.nextRoute['sub'].nextRoute,
                ['sub-one-get', 'sub-two-get', 'sub-one-put', 'sub-one-post', 'sub-one-delete'], 'Subs sub route not added');
            assert.hasAnyKeys(parentRoute.nextRoute, ['sub-one-get'], 'OtherSub route not added');
            assert.hasAnyKeys(parentRoute.nextRoute['sub-one-get'].nextRoute,
                ['test', 'my-test-sub', 'my-other-sub', 'hello'], 'OtherSubs sub route not added');
        });
    });

    describe('Middleware', () => {

        it('should add middleware', () => {

            assert.equal(helloRoute.middleware.length, 1);

            const a: iMiddleware = {
                alter: (req, res) => {
                    return true;
                }
            };

            helloRoute.use(a);

            assert.equal(helloRoute.middleware.length, 2);

        });
    });

});