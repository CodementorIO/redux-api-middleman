import nock from 'nock'
import { camelizeKeys, decamelizeKeys } from 'humps'

import log from '../src/log'
import createApiMiddleware, {
  CALL_API,
  CHAIN_API
} from '../src'

import * as utils from '../src/utils'

jest.mock('../src/log', () => ({
  error: jest.fn()
}))

jest.mock('../src/log', () => ({
  error: jest.fn()
}))

export const BASE_URL = 'http://localhost:3000'

describe('Middleware::Api', () => {
  let apiMiddleware
  let dispatch, getState, next
  let action

  beforeEach(() => {
    apiMiddleware = createApiMiddleware({ baseUrl: BASE_URL })
    dispatch = jest.fn()
    getState = jest.fn()
    next = jest.fn()
    utils.window = {}
  })

  describe('when called with [CHAIN_API]', () => {
    const successType1 = 'ON_SUCCESS_1'
    const successType2 = 'ON_SUCCESS_2'
    const sendingType1 = 'ON_SENDING_1'
    const sendingType2 = 'ON_SENDING_2'
    const errorType2 = 'ON_ERROR_2'

    let nockScope1, nockScope2

    let afterSuccess1, afterSuccess2
    const response1 = { id: 'the-id-1', to_be_camelized: 'snake-val' }
    const response2 = { id: 'the-res-2' }
    const path1 = '/the-url/path-1'
    const path2 = `/the-url/${response1.id}`

    let afterError1
    let afterError2

    beforeEach(() => {
      afterSuccess1 = jest.fn()
      afterSuccess2 = jest.fn()
      afterError1 = jest.fn()
      afterError2 = jest.fn()
      action = {
        [CHAIN_API]: [
          () => {
            return {
              extra1: 'val1',
              [CALL_API]: {
                method: 'post',
                body: { bodyKey: 'body-val' },
                query: decamelizeKeys({ queryKey: 'query-val' }),
                path: path1,
                afterSuccess: afterSuccess1,
                afterError: afterError1,
                successType: successType1,
                sendingType: sendingType1
              }
            }
          },
          (_resBody1) => {
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
    function nockRequest2 (status = 200, payload) {
      return nock(BASE_URL).get('/the-url/the-id-1')
        .reply(status, payload || response2)
    }

    afterEach(() => {
      nock.cleanAll()
    })

    describe('when sending GET request', () => {
      const host = 'http://get-request-host.com'
      const path = '/the-path'
      let nockScope
      beforeEach(() => {
        action = {
          [CHAIN_API]: [
            () => {
              return {
                [CALL_API]: {
                  url: `${host}${path}`,
                  method: 'get',
                  successType: successType1
                }
              }
            }
          ]
        }
      })
      it('does not send body', async () => {
        nockScope = nock(host).get(path, body => !body).reply(200, response1)
        await apiMiddleware({ dispatch, getState })(next)(action)
        nockScope.done()
      })
    })

    describe('when `url` is given in CALL_API', () => {
      const host = 'http://another-host.com'
      const path = '/the-path'
      let nockScope

      beforeEach(() => {
        action = {
          [CHAIN_API]: [
            () => {
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
      it('takes precedence over path', async () => {
        await apiMiddleware({ dispatch, getState })(next)(action)
        nockScope.done()
      })
    })

    describe('when `camelizeResponse` is false', () => {
      const path = '/the-path'
      let nockScope

      beforeEach(() => {
        action = {
          [CHAIN_API]: [
            () => {
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
      it('does not camelize response', async () => {
        await apiMiddleware({ dispatch, getState })(next)(action)
        expect(dispatch).toBeCalledWith({
          type: successType1,
          response: response1
        })
        nockScope.done()
      })
    })

    describe('when `decamelizeRequest` is false', () => {
      const path = '/the-path'

      beforeEach(() => {
        action = {
          [CHAIN_API]: [
            () => {
              return {
                [CALL_API]: {
                  path,
                  method: 'post',
                  body: { camelCase: 'OYOYO' },
                  decamelizeRequest: false,
                  successType: successType1
                }
              }
            }]
        }
        nock(BASE_URL).post(path, { camelCase: 'OYOYO' }).reply(200, response1)
      })
      it('should pass', async () => {
        await apiMiddleware({ dispatch, getState })(next)(action)
        expect(dispatch).toBeCalledWith({
          type: successType1,
          response: camelizeKeys(response1)
        })
      })
    })

    describe('when generateDefaultParams is provided', () => {
      const path = '/the-path'
      let nockScope
      let generateDefaultParams
      beforeEach(() => {
        generateDefaultParams = jest.fn(() => ({
          body: { additionalBodyKey: 'additionalBodyVal' },
          query: { additionalKey: 'additionalVal' },
          headers: { additionalHeadersKey: 'additionalHeadersVal' }
        }))
        apiMiddleware = createApiMiddleware({
          baseUrl: BASE_URL,
          generateDefaultParams
        })
      })

      beforeEach(() => {
        action = {
          [CHAIN_API]: [
            () => {
              return {
                [CALL_API]: {
                  path: `${path}`,
                  method: 'post',
                  body: { bodyKey: 'bodyVal' },
                  headers: { headersKey: 'headersVal' },
                  successType: successType1
                }
              }
            }
          ]
        }

        nockScope = nock(BASE_URL)
          .matchHeader('additionalHeadersKey', 'additionalHeadersVal')
          .matchHeader('headersKey', 'headersVal')
          .post(path, decamelizeKeys({
            additionalBodyKey: 'additionalBodyVal',
            bodyKey: 'bodyVal'
          }))
          .query(decamelizeKeys({
            additionalKey: 'additionalVal'
          }))
          .reply(200, response1)
      })
      it('merge generateDefaultParams into request', async () => {
        await apiMiddleware({ dispatch, getState })(next)(action)
        expect(dispatch).toBeCalledWith({
          type: successType1,
          response: camelizeKeys(response1)
        })
        nockScope.done()
      })
    })

    describe('when all API calls are success', () => {
      beforeEach(() => {
        nockScope1 = nockRequest1()
        nockScope2 = nockRequest2()
      })

      it('sends requests to all endpoints', async () => {
        await apiMiddleware({ dispatch, getState })(next)(action)
        nockScope1.done()
        nockScope2.done()
      })

      it('trigger afterSuccess for all endpoints', async () => {
        await apiMiddleware({ dispatch, getState })(next)(action)
        expect(afterSuccess1).toBeCalledWith({
          getState, dispatch, response: camelizeKeys(response1)
        })
        expect(afterSuccess2).toBeCalledWith({
          getState, dispatch, response: camelizeKeys(response2)
        })
      })

      it('only catches request error', async () => {
        afterSuccess1.mockImplementation(() => {
          throw new Error('error casued by afterSuccess')
        })
        await apiMiddleware({ dispatch, getState })(next)(action)
        expect(afterError1).not.toBeCalled()
        expect(afterSuccess1).toBeCalled()
        expect(log.error).toBeCalled()
      })
      it('trigger sendintType for all endpoints', async () => {
        await apiMiddleware({ dispatch, getState })(next)(action)
        expect(dispatch).toBeCalledWith({ type: sendingType1, extra1: 'val1' })
        expect(dispatch).toBeCalledWith({ type: sendingType2, extra2: 'val2' })
      })

      it('dispatch successType for all endpoints', async () => {
        await apiMiddleware({ dispatch, getState })(next)(action)
        expect(dispatch).toBeCalledWith({
          type: successType1, response: camelizeKeys(response1), extra1: 'val1'
        })
        expect(dispatch).toBeCalledWith({
          type: successType2, response: camelizeKeys(response2), extra2: 'val2'
        })
      })
    })

    describe('when one of the apis timeout', () => {
      const timeout = 50
      const host = 'http://another-host.com'
      const path = '/the-path'
      const timeoutErrorType = 'TIMEOUT_ERROR'
      let nockScope
      let dispatchedAction

      beforeEach(() => {
        dispatch = (a) => {
          dispatchedAction = a
        }
        apiMiddleware = createApiMiddleware({
          baseUrl: BASE_URL,
          timeout
        })
        action = {
          [CHAIN_API]: [
            () => {
              return {
                [CALL_API]: {
                  url: `${host}${path}`,
                  method: 'get',
                  errorType: timeoutErrorType
                }
              }
            }
          ]
        }
        nockScope = nock(host).get(path).delay(timeout + 1).reply(200)
      })

      it('dispatch error when timeout', async () => {
        await apiMiddleware({ dispatch, getState })(next)(action)
        expect(dispatchedAction.type).toEqual(timeoutErrorType)
        nockScope.done()
      })
    })

    describe('when one of the apis failed', () => {
      let errorPayload
      beforeEach(() => {
        errorPayload = {
          data: {
            AAA: 'AAAAAAAAAA'
          }
        }
        nockScope1 = nockRequest1()
        nockScope2 = nockRequest2(400, errorPayload)
      })

      it('sends request until it is failed', async () => {
        await apiMiddleware({ getState, dispatch })(next)(action)
        nockScope1.done()
        nockScope2.done()
      })

      it('triggers afterSuccess and dispatches success for the ok ones', async () => {
        await apiMiddleware({ dispatch, getState })(next)(action)
        expect(dispatch).toBeCalledWith({
          extra1: 'val1',
          type: successType1,
          response: camelizeKeys(response1)
        })
        expect(afterSuccess1).toBeCalledWith({
          getState, dispatch, response: camelizeKeys(response1)
        })
      })

      it('trigger afterError of path2', async () => {
        await apiMiddleware({ dispatch, getState })(next)(action)
        expect(afterError2).toBeCalledWith({
          getState,
          dispatch,
          error: expect.objectContaining({
            data: camelizeKeys(errorPayload)
          })
        })
      })

      it('dispatches errorType of path2', async () => {
        let dispatchedAction
        dispatch = (a) => {
          dispatchedAction = a
        }
        await apiMiddleware({ dispatch, getState })(next)(action)
        expect(dispatchedAction.type).toEqual(errorType2)
        expect(dispatchedAction.error.status).toEqual(400)
      })

      it('dispatches errorType with backward compatible error payload', async () => {
        let dispatchedAction
        dispatch = (a) => {
          dispatchedAction = a
        }
        await apiMiddleware({ dispatch, getState })(next)(action)
        expect(dispatchedAction.type).toEqual(errorType2)
        expect(dispatchedAction.error.data).toEqual(camelizeKeys(errorPayload))
      })

      describe('errorInterceptor behaviors', () => {
        it('handles dispatch and rejection stuff via `proceedError`', async () => {
          const spy = jest.fn()
          let dispatchedAction
          dispatch = (a) => {
            dispatchedAction = a
          }
          apiMiddleware = createApiMiddleware({
            baseUrl: BASE_URL,
            errorInterceptor: ({ proceedError, err, replay, getState }) => {
              spy()
              expect(getState).toEqual(getState)
              proceedError()
            }
          })
          await apiMiddleware({ dispatch, getState })(next)(action)
          expect(spy).toBeCalled()
          expect(dispatchedAction.type).toEqual(errorType2)
          expect(dispatchedAction.error.status).toEqual(400)
        })

        describe('replay', () => {
          function repeat (times, fn) {
            for (var i = 0; i < times; i += 1) {
              fn()
            }
          }
          it('resend the request', async () => {
            nockRequest2(400)
            let errTime = 0
            apiMiddleware = createApiMiddleware({
              baseUrl: BASE_URL,
              errorInterceptor: ({ proceedError, err, replay, getState }) => {
                if (errTime === 1) {
                  proceedError()
                } else {
                  replay()
                  errTime++
                }
              }
            })

            await apiMiddleware({ dispatch, getState })(next)(action)
            expect(errTime).toEqual(1)
          })
          it('replay no more than `maxReplayTimes`', async () => {
            let replayTimes = 0
            const maxReplayTimes = 6
            let dispatchedAction
            repeat(6, () => nockRequest2(400))
            dispatch = (a) => {
              dispatchedAction = a
            }
            apiMiddleware = createApiMiddleware({
              baseUrl: BASE_URL,
              maxReplayTimes,
              errorInterceptor: ({ proceedError, replay, _getState }) => {
                replayTimes++
                replay()
              }
            })
            await apiMiddleware({ dispatch, getState })(next)(action)
            expect(replayTimes).toEqual(6)
            expect(dispatchedAction.type).toEqual(errorType2)
            expect(dispatchedAction.error).toBeInstanceOf(Error)
            expect(dispatchedAction.error.message).toEqual(
              `reached MAX_REPLAY_TIMES = ${maxReplayTimes}`
            )
          })
        })
      })
    })
  })

  describe('when action is without CALL_API and CHAIN_API', () => {
    it('passes the action to next middleware', async () => {
      const nextRetResult = {}
      next.mockReturnValue(nextRetResult)
      action = { type: 'not-CALL_API' }
      const result = await apiMiddleware({ dispatch, getState })(next)(action)

      expect(next).toBeCalledWith(action)
      expect(result).toEqual(nextRetResult)
    })
  })

  describe('when action is with `CALL_API`', () => {
    const successType = 'ON_SUCCESS'
    const path = '/the-url/path'
    let dispatchedAction

    beforeEach(() => {
      dispatch = function (a) {
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
    it('forwards it to CHAIN_API as a special case', async () => {
      await apiMiddleware({ dispatch, getState })(next)(action)
      expect(dispatchedAction[CHAIN_API].length).toEqual(1)
      expect(dispatchedAction[CHAIN_API][0]()).toEqual(action)
    })
  })
})
