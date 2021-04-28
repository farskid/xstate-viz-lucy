function compile(input) {
  console.log(compileXstate);
  const js = compileXstate(input, "input.lucy");

  output.textContent = js;
}
