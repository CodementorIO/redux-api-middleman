import Promise from 'es6-promise'
import { CALL_API } from '../src'
import createRequestPromise from '../src/createRequestPromise'
import axios from 'axios'

jest.mock('axios')
jest.mock('../src/log')

const getMockAxiosPromise = ({ error } = {}) => {
  return new Promise((resolve, reject) => {
    if (error) {
      process.nextTick(() => reject(new Error({
        response: {
          data: {
            key_1: 'val_1'
          }
        }
      })))
    } else {
      process.nextTick(() => resolve({
        data: {
          key_1: 'val_1'
        }
      }))
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
      sendingType: 'sendingType',
      camelizeResponse: true
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

  describe('when axios catches error', () => {
    beforeEach(() => {
      axios.mockReturnValue(getMockAxiosPromise({ error: true }))
    })
    it('should call errorInterceptor', () => {
      const errorInterceptor = jest.fn(({ proceedError }) => {
        proceedError()
      })
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
        .catch(() => {
          expect(errorInterceptor).toHaveBeenCalledTimes(1)
          expect(errorInterceptor.mock.calls[0][0]).toMatchObject({
            err: {
              data: {
                key1: 'val_1'
              }
            },
            dispatch,
            getState
          })
        })
    })
  })
})
