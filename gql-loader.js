const oldJSHook = require.extensions[".js"];

const loader = (module, filename) => {
  const oldJSCompile = module._compile;
  module._compile = function (code, file) {
    code = `module.exports = \`\r${code}\`;`;
    module._compile = oldJSCompile;
    module._compile(code, file);
  };
  oldJSHook(module, filename);
};

require.extensions[".graphql"] = loader;
require.extensions[".gql"] = loader;