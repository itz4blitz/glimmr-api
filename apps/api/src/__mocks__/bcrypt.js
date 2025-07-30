/* eslint-env jest, node */
// Mock bcrypt for Jest tests to avoid native module issues
module.exports = {
  hash: jest
    .fn()
    .mockImplementation((data, rounds) =>
      Promise.resolve(`hashed_${data}_${rounds}`),
    ),
  compare: jest
    .fn()
    .mockImplementation((data, hash) =>
      Promise.resolve(hash === `hashed_${data}_10`),
    ),
  hashSync: jest
    .fn()
    .mockImplementation((data, rounds) => `hashed_${data}_${rounds}`),
  compareSync: jest
    .fn()
    .mockImplementation((data, hash) => hash === `hashed_${data}_10`),
  genSalt: jest.fn().mockImplementation(() => Promise.resolve("mockedsalt")),
  genSaltSync: jest.fn().mockImplementation(() => "mockedsalt"),
  getRounds: jest.fn().mockImplementation(() => 10),
};
