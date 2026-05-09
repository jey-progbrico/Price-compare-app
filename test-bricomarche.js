async function testBricomarche() {
  try {
    const res = await fetch("https://www.bricomarche.com/recherche?q=3103220009574", {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    console.log("Bricomarche Status: " + res.status);
  } catch(e) {
    console.log("Bricomarche Error: " + e.message);
  }
}
testBricomarche();
