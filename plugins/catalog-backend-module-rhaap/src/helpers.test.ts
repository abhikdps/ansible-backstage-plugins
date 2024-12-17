import { formatNameSpace } from './helpers';

describe('helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('format name space', () => {
    const result = formatNameSpace('test default ++test 123');
    expect(result).toEqual('test-default-test-123');
  });
});
