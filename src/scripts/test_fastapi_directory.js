async function test() {
  console.log('Sending query: "give me the directory structure of FastAPI"...\n');
  const t0 = Date.now();
  const res = await fetch('http://localhost:3000/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'give me the directory structure of FastAPI'
    })
  });

  const data = await res.json();
  const elapsed = Date.now() - t0;
  console.log(`Finished in ${elapsed}ms`);
  console.log('Widget Type:', data.type);
  console.log('Widget Title:', data.title || data.label);
  console.log('Routed Agent:', data._agentChain);
  console.log('Repo Name in Meta:', data._meta?.repoName);

  if (data.root) {
    console.log('Root Name:', data.root.name);
    console.log('Root Description:', data.root.description);
    console.log('Root Children Count:', data.root.children?.length);
    console.log('Root Top-Level Items:', data.root.children?.map(c => `${c.type === 'directory' ? '[DIR]' : '[FILE]'} ${c.name}`));
    const fastapiChild = data.root.children?.find(c => c.name === 'fastapi');
    if (fastapiChild) {
      console.log('\nInside fastapi/ package:');
      console.log(fastapiChild.children?.map(c => `${c.type === 'directory' ? '[DIR]' : '[FILE]'} ${c.name}`).slice(0, 15));
    }
  } else {
    console.log('Response content:', JSON.stringify(data, null, 2).slice(0, 500));
  }
}

test().catch(console.error);
