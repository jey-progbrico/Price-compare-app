async function testSearx(ean) {
  const instances = [
    "https://searx.be",
    "https://searx.tiekoetter.com",
    "https://paulgo.io"
  ];
  
  for (let instance of instances) {
    try {
      console.log("Trying " + instance);
      const url = `${instance}/search?q=${ean}+prix&format=json`;
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const data = await response.json();
      
      console.log(`=> Success from ${instance}, got ${data.results.length} results.`);
      if (data.results.length > 0) {
        console.log("- " + data.results[0].title);
        console.log("  " + data.results[0].url);
        break;
      }
    } catch(e) {
      console.error("=> Failed: " + e.message);
    }
  }
}

testSearx("3103220009574");
