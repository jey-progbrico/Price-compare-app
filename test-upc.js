async function testUPC(ean) {
  try {
    const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${ean}`;
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(JSON.stringify(data, null, 2));
  } catch(e) {
    console.error("=> Failed: " + e.message);
  }
}

testUPC("3103220009574");
