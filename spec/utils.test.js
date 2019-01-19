import { paramsExtractor, actionWith } from '../src/utils'
import { CALL_API } from '../src'

describe('Utils', () => {
  describe('#paramsExtractor', () => {
    let params
    const baseUrl = 'http://base'
    const callApi = {
      path: '/path'
    }
    beforeEach(() => {
      params = paramsExtractor({ baseUrl })(callApi)
    })
    it('sets `url` with prefix baseUrl', () => {
      expect(params.url).toEqual(
        `${baseUrl}${callApi.path}`
      )
    })
    it('defaults to set withCredentials to ture', () => {
      expect(params.withCredentials).toEqual(true)
    })
  })

  describe('#actionWith', () => {
    it('removes CALL_API and merges payload', () => {
      const action = {
        extra: 'extra',
        [CALL_API]: {
          path: 'path'
        }
      }
      const payload = {
        type: 'type'
      }
      expect(actionWith(action, payload)).toEqual({
        extra: 'extra',
        ...payload
      })
    })
  })
})
