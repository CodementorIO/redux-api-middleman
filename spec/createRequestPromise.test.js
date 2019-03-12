import Promise from 'yaku/lib/yaku.core'
import { CALL_API } from '../src'
import createRequestPromise from '../src/createRequestPromise'
import axios from 'axios'

jest.mock('axios')

const getMockAxiosPromise = ({ error } = {}) => {
  new Promise((resolve, reject) => {
    const res = {
      data: {
        key_1: 'val_1'
      }
    }
    if (error) {
      process.nextTick(() => reject(res))
    } else {
      process.nextTick(() => resolve(res))
    }
  })
}

const getLastCall = (mockFunction) => {
  return mockFunction.mock.calls[mockFunction.mock.calls.length - 1]
}

describe('createRequestPromise', () => {
  let timeout
  let generateDefaultParams
  let createCallApiAction
  let getState
  let dispatch
  let errorInterceptor
  let extractParams
  let maxReplayTimes
  let mockApiAction, mockParams, mockDefaultParams
  let mockPrevBody
  beforeEach(() => {
    axios.mockReturnValue(getMockAxiosPromise())
    mockApiAction = {
      [CALL_API]: {}
    }
    mockParams = {
      method: 'get',
      sendingType: 'sendingType'
    }
    mockDefaultParams = {
      headers: {},
      body: {},
      query: {}
    }
    createCallApiAction = jest.fn().mockReturnValue(mockApiAction)
    generateDefaultParams = jest.fn().mockReturnValue(mockDefaultParams)
    errorInterceptor = jest.fn()
    extractParams = jest.fn().mockReturnValue(mockParams)
    dispatch = jest.fn()
    getState = jest.fn()
    mockPrevBody = {}
    console.log()
  })
  it('should return a Promise', () => {
    const promise = createRequestPromise({
      timeout,
      generateDefaultParams,
      createCallApiAction,
      getState,
      dispatch,
      errorInterceptor,
      extractParams,
      maxReplayTimes
    })(mockPrevBody)
    expect(promise).toBeInstanceOf(Promise)
  })
  it('should call axios without `data` key when method is `get`', () => {
    mockParams.method = 'get'
    createRequestPromise({
      timeout,
      generateDefaultParams,
      createCallApiAction,
      getState,
      dispatch,
      errorInterceptor,
      extractParams,
      maxReplayTimes
    })(mockPrevBody)
    const firstArgument = getLastCall(axios)[0]
    expect(firstArgument).not.toHaveProperty('data')
  })
  it('should call axios with `data` key when method is `post`', () => {
    mockParams.method = 'post'
    createRequestPromise({
      timeout,
      generateDefaultParams,
      createCallApiAction,
      getState,
      dispatch,
      errorInterceptor,
      extractParams,
      maxReplayTimes
    })(mockPrevBody)
    const firstArgument = getLastCall(axios)[0]
    expect(firstArgument).toHaveProperty('data')
  })
  it('should stringify body when `Content-Type = application/x-www-form-urlencoded`', () => {
    const params = Object.assign({}, mockParams, {
      method: 'post',
      body: {
        key: 'val'
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
    extractParams.mockReturnValueOnce(Object.assign({}, params))
    createRequestPromise({
      timeout,
      generateDefaultParams,
      createCallApiAction,
      getState,
      dispatch,
      errorInterceptor,
      extractParams,
      maxReplayTimes
    })(mockPrevBody)
    const firstArgument = getLastCall(axios)[0]
    expect(firstArgument.data).toBe('key=val')
  })
  it('should set body to data when `Content-Type = application/json`', () => {
    const body = {
      key: 'val'
    }
    const params = Object.assign({}, mockParams, {
      method: 'post',
      body,
      headers: {
        'Content-Type': 'application/json'
      }
    })
    extractParams.mockReturnValueOnce(Object.assign({}, params))
    createRequestPromise({
      timeout,
      generateDefaultParams,
      createCallApiAction,
      getState,
      dispatch,
      errorInterceptor,
      extractParams,
      maxReplayTimes
    })(mockPrevBody)
    const firstArgument = getLastCall(axios)[0]
    expect(firstArgument.data).toEqual(body)
  })

  describe('when error occurs', () => {
    beforeEach(() => {
      axios.mockReturnValue(getMockAxiosPromise({ error: true }))
    })
    describe('errorInterceptor behavior', () => {
      it('should be called with proceedError, err and getState', () => {
        createRequestPromise({
          timeout,
          generateDefaultParams,
          createCallApiAction,
          getState,
          dispatch,
          errorInterceptor,
          extractParams,
          maxReplayTimes
        })(mockPrevBody)
      })
      expect(errorInterceptor).toHaveBeenCalledTimes(1)
      expect(errorInterceptor.mock.calls[0][0]).toMatchObject({
        err: {
          response: {
            body: {
              key_1: 'val_1'
            }
          }
        },
        getState
      })
    })
    it('should return camelized payload if camelizeResponse is true', () => {

    })
  })
})
