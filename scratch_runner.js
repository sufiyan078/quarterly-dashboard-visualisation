require('ts-node').register({
  compilerOptions: {
    module: "commonjs",
    target: "es2020"
  }
});
require('./src/lib/inventory/test_parse_bartec.ts');
