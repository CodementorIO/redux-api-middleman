import nock from 'nock'
import sinon from 'sinon'
import sinonChai from 'sinon-chai'
import chai, { expect } from 'chai'
import superagent from 'superagent'
import { camelizeKeys, decamelizeKeys } from 'humps'

import createApiMiddleware, { CALL_API, CHAIN_API } from 'index'

chai.use(sinonChai)

describe('Middleware::Api', ()=> {
  let apiMiddleware
  let dispatch, getState, next
  let action
  const BASE_URL = 'http://localhost:3000'

  beforeEach(()=> {
    apiMiddleware = createApiMiddleware({ baseUrl: BASE_URL })
    dispatch = sinon.stub()
    getState = sinon.stub()
    next = sinon.stub()
  })

  describe('when called with [CHAIN_API]', ()=> {
    let successType1 = 'ON_SUCCESS_1'
    let successType2 = 'ON_SUCCESS_2'
    let sendingType1 = 'ON_SENDING_1'
    let sendingType2 = 'ON_SENDING_2'
    let errorType2 = 'ON_ERROR_2'

    let nockScope1, nockScope2

    let afterSuccess1, afterSuccess2
    let response1 = { id: 'the-id-1', to_be_camelized: 'snake-val' }
    let response2 = { id: 'the-res-2' }
    let path1 = '/the-url/path-1'
    let path2 = `/the-url/${response1.id}`

    let afterError2

    beforeEach(()=> {
      afterSuccess1 = sinon.stub()
      afterSuccess2 = sinon.stub()
      afterError2 = sinon.stub()
      action = {
        [CHAIN_API]: [
          ()=> {
            return {
              extra1: 'val1',
              [CALL_API]: {
                method: 'post',
                body: { bodyKey: 'body-val' },
                query: decamelizeKeys({ queryKey: 'query-val' }),
                path: path1,
                afterSuccess: afterSuccess1,
                successType: successType1,
                sendingType: sendingType1
              }
            }
          },
          (_resBody1)=> {
            return {
              extra2: 'val2',
              [CALL_API]: {
                method: 'get',
                path: path2,
                afterSuccess: afterSuccess2,
                afterError: afterError2,
                successType: successType2,
                sendingType: sendingType2,
                errorType: errorType2
              }
            }
          }
        ]
      }
    })

    function nockRequest1 () {
      return nock(BASE_URL).post(path1)
                           .query(decamelizeKeys({ queryKey: 'query-val' }))
                           .reply(200, response1)
    }
    function nockRequest2 (status = 200) {
      return nock(BASE_URL).get('/the-url/the-id-1')
                           .reply(status, response2)
    }

    afterEach(()=> {
      nock.cleanAll()
    })

    describe('when `url` is given in CALL_API', ()=> {
      let host = 'http://another-host.com'
      let path = '/the-path'
      let nockScope

      beforeEach(()=> {
        nock.cleanAll()
        action = {
          [CHAIN_API]: [
            ()=> {
              return {
                [CALL_API]: {
                  url: `${host}${path}`,
                  method: 'get',
                  successType: successType1
                }
              }
            }]
        }
        nockScope = nock(host).get(path).reply(200, response1)
      })
      it('takes precedence over path', (done)=> {
        let promise = apiMiddleware({ dispatch, getState })(next)(action)

        promise.then(()=> {
          nockScope.done()
          done()
        })
      })
    })

    describe('when `camelizeResponse` is false', ()=> {
      let path = '/the-path'
      let nockScope

      beforeEach(()=> {
        nock.cleanAll()
        action = {
          [CHAIN_API]: [
            ()=> {
              return {
                [CALL_API]: {
                  path: `${path}`,
                  method: 'get',
                  camelizeResponse: false,
                  successType: successType1
                }
              }
            }]
        }
        nockScope = nock(BASE_URL).get(path).reply(200, response1)
      })
      it('does not camelize response', (done)=> {
        let promise = apiMiddleware({ dispatch, getState })(next)(action)
        promise.then(()=> {
          expect(dispatch).to.have.been
            .calledWith({
              type: successType1,
              response: response1
            })
          nockScope.done()
          done()
        })
      })
    })

    describe('when `decamelizeRequest` is false', ()=> {
      let path = '/the-path'
      let nockScope

      beforeEach(()=> {
        nock.cleanAll()
        action = {
          [CHAIN_API]: [
            ()=> {
              return {
                [CALL_API]: {
                  path: `${path}`,
                  method: 'post',
                  body: { camelCase: 'OYOYO' },
                  decamelizeRequest: false,
                  successType: successType1
                }
              }
            }]
        }
        nockScope = nock(BASE_URL).post(path, { camelCase: 'OYOYO' }).reply(200, response1)
      })
      it('should pass', (done)=> {
        let promise = apiMiddleware({ dispatch, getState })(next)(action)
        promise.then(()=> {
          expect(dispatch).to.have.been
            .calledWith({
              type: successType1,
              response: camelizeKeys(response1)
            })
          nockScope.done()
          done()
        })
      })
    })

    describe('when generateDefaultParams is provided', ()=> {
      let path = '/the-path'
      let nockScope
      let apiMiddleware
      let generateDefaultParams
      beforeEach(()=> {
        generateDefaultParams = sinon.stub()
        generateDefaultParams.returns({
          body: { additionalBodyKey: 'additionalBodyVal' },
          query: { additionalKey: 'additionalVal' },
          headers: { additionalHeadersKey: 'additionalHeadersVal' }
        })
        apiMiddleware = createApiMiddleware({ baseUrl: BASE_URL, generateDefaultParams })
      })

      beforeEach(()=> {
        nock.cleanAll()
        action = {
          [CHAIN_API]: [
            ()=> {
              return {
                [CALL_API]: {
                  path: `${path}`,
                  method: 'post',
                  body: { bodyKey: 'bodyVal' },
                  headers: { headersKey: 'headersVal' },
                  successType: successType1
                }
              }
            }]
        }

        nockScope = nock(BASE_URL)
          .matchHeader('additionalHeadersKey', 'additionalHeadersVal')
          .matchHeader('headersKey', 'headersVal' )
          .post(path, decamelizeKeys({
            additionalBodyKey: 'additionalBodyVal',
            bodyKey: 'bodyVal'
          }))
          .query(decamelizeKeys({
            additionalKey: 'additionalVal'
          }))
          .reply(200, response1)
      })
      it('merge generateDefaultParams into request', (done)=> {
        let promise = apiMiddleware({ dispatch, getState })(next)(action)

        promise.then(()=> {
          expect(dispatch).to.have.been
            .calledWith({
              type: successType1,
              response: camelizeKeys(response1)
            })
          nockScope.done()
          done()
        })
      })
    })


    describe('when all API calls are success', ()=> {
      beforeEach(()=> {
        nockScope1 = nockRequest1()
        nockScope2 = nockRequest2()
      })

      it('sends requests to all endpoints', (done)=> {
        let promise = apiMiddleware({ dispatch, getState })(next)(action)

        promise.then(()=> {
          nockScope1.done()
          nockScope2.done()
          done()
        })
      })
      it('trigger afterSuccess for all endpoints', (done)=> {
        let promise = apiMiddleware({ dispatch, getState })(next)(action)
        promise.then(()=> {
          expect(afterSuccess1).to.have.been.calledWith({ getState, dispatch, response: camelizeKeys(response1) })
          expect(afterSuccess2).to.have.been.calledWith({ getState, dispatch, response: camelizeKeys(response2) })
          done()
        })
      })
      it('trigger sendintType for all endpoints', (done)=> {
        let promise = apiMiddleware({ dispatch, getState })(next)(action)
        promise.then(()=> {
          expect(dispatch).to.have.been
            .calledWith({ type: sendingType1, extra1: 'val1' })
          expect(dispatch).to.have.been
            .calledWith({ type: sendingType2,  extra2: 'val2' })
          done()
        })
      })
      it('dispatch successType for all endpoints', (done)=> {
        let promise = apiMiddleware({ dispatch, getState })(next)(action)
        promise.then(()=> {
          expect(dispatch).to.have.been
            .calledWith({ type: successType1, response: camelizeKeys(response1), extra1: 'val1' })
          expect(dispatch).to.have.been
            .calledWith({ type: successType2, response: camelizeKeys(response2), extra2: 'val2' })
          done()
        })
      })
    })

    describe('when one of the apis timeout', ()=> {
      let timeout = 50
      let host = 'http://another-host.com'
      let path = '/the-path'
      let timeoutErrorType = 'TIMEOUT_ERROR'
      let nockScope
      let apiMiddleware, dispatchedAction

      beforeEach(()=> {
        dispatch = function(a) {
          dispatchedAction = a
        }
        apiMiddleware = createApiMiddleware({
          baseUrl: BASE_URL,
          timeout,
        })
        nock.cleanAll()
        action = {
          [CHAIN_API]: [
            ()=> {
              return {
                [CALL_API]: {
                  url: `${host}${path}`,
                  method: 'get',
                  errorType: timeoutErrorType
                }
              }
            }]
        }
        nockScope = nock(host).get(path).delay(timeout+1).reply(200)
      })

      it('dispatch error when timeout', (done) => {
        apiMiddleware({ dispatch, getState })(next)(action)
          .then(()=> {
            expect(dispatchedAction.type).to.equal(timeoutErrorType)
            nockScope.done()
            done()
          })
      })
    })

    describe('when one of the apis failed', ()=> {
      beforeEach(()=> {
        nockScope1 = nockRequest1()
        nockScope2 = nockRequest2(400)
      })
      it('sends request until it\'s failed', (done)=> {
        let promise = apiMiddleware({ getState, dispatch })(next)(action)
        promise.then(()=> {
          nockScope1.done()
          nockScope2.done()
          done()
        })
      })
      it('triggers afterSuccess and dispatches success for the ok ones', (done)=> {
        let promise = apiMiddleware({ dispatch, getState })(next)(action)
        promise.then(()=> {
          expect(dispatch).to.have.been.calledWith({
            extra1: 'val1',
            type: successType1,
            response: camelizeKeys(response1)
          })
          expect(afterSuccess1).to.have.been.calledWith({ getState, dispatch, response: camelizeKeys(response1) })
          done()
        })
      })
      it('trigger afterError of path2', (done)=> {
        let promise = apiMiddleware({ dispatch, getState })(next)(action)
        promise.then(()=> {
          expect(afterError2).to.have.been.calledWith({ getState })
          done()
        })
      })
      it('dispatches errorType of path2', (done)=> {
        let dispatchedAction
        dispatch = function(a) {
          dispatchedAction = a
        }
        let promise = apiMiddleware({ dispatch, getState })(next)(action)
        promise.then(()=> {
          expect(dispatchedAction.type).to.equal(errorType2)
          expect(dispatchedAction.error).to.be.an.instanceOf(Error)
          done()
        })
      })

      describe('errorInterceptor behaviors', ()=> {
        it('handles dispatch and rejection stuff via `proceedError`', (done)=> {
          let spy = sinon.spy()
          let dispatchedAction
          dispatch = function(a) {
            dispatchedAction = a
          }
          apiMiddleware = createApiMiddleware({
            baseUrl: BASE_URL,
            errorInterceptor: ({ proceedError, err, replay, getState })=> {
              spy()
              expect(getState).to.equal(getState)
              proceedError()
            }
          })
          apiMiddleware({ dispatch, getState })(next)(action)
            .then(()=> {
              expect(spy).to.have.been.called
              expect(dispatchedAction.type).to.equal(errorType2)
              expect(dispatchedAction.error).to.be.an.instanceOf(Error)
              done()
            })
        })

        describe('replay', ()=> {
          beforeEach(()=> sinon.spy(superagent, 'get'))
          afterEach(()=> superagent.get.restore())

          it('resend the request', (done)=> {
            let errTime = 0
            apiMiddleware = createApiMiddleware({
              baseUrl: BASE_URL,
              errorInterceptor: ({ proceedError, err, replay, getState })=> {
                if (errTime == 1) {
                  proceedError()
                } else {
                  replay()
                  errTime ++
                }
              }
            })

            apiMiddleware({ dispatch, getState })(next)(action)
              .then(()=> {
                expect(superagent.get).to.have.been
                  .calledWith(`${BASE_URL}${path2}`)
                expect(superagent.get.callCount).to.equal(2)
                done()
              })
          })
          it('replay no more than `maxReplayTimes`', (done) => {
            let replayTimes = 0
            let maxReplayTimes = 6
            let dispatchedAction
            dispatch = function(a) {
              dispatchedAction = a
            }
            apiMiddleware = createApiMiddleware({
              baseUrl: BASE_URL,
              maxReplayTimes,
              errorInterceptor: ({ proceedError, replay, _getState })=> {
                replayTimes ++
                replay()
              }
            })
            apiMiddleware({ dispatch, getState })(next)(action)
              .then(()=> {
                expect(superagent.get.callCount).to.equal(replayTimes + 1)
                expect(dispatchedAction.type).to.equal(errorType2)
                expect(dispatchedAction.error).to.be.an.instanceOf(Error)
                expect(dispatchedAction.error.message).to.equal(
                  `reached MAX_REPLAY_TIMES = ${maxReplayTimes}`
                )
                done()
              })
          })
        })
      })
    })

  })

  describe('when action is without CALL_API and CHAIN_API', ()=> {
    it('passes the action to next middleware', ()=> {
      let nextRetResult = {}
      next.returns(nextRetResult)

      action = { type: 'not-CALL_API' }
      let result = apiMiddleware({ dispatch, getState })(next)(action)
      expect(next).to.have.been.calledWith(action)
      expect(result).to.equal(nextRetResult)
    })
  })

  describe('when action is with `CALL_API`', ()=> {
    let successType = 'ON_SUCCESS'
    let path = '/the-url/path'
    let dispatchedAction

    beforeEach(()=> {
      dispatch = function(a) {
        dispatchedAction = a
      }
      action = {
        [CALL_API]: {
          method: 'get',
          path,
          successType
        }
      }
    })
    it('forwards it to CHAIN_API as a special case', ()=> {
      apiMiddleware({ dispatch, getState })(next)(action)
      expect(dispatchedAction[CHAIN_API].length).to.equal(1)
      expect(dispatchedAction[CHAIN_API][0]()).to.equal(action)
    })
  })

})
