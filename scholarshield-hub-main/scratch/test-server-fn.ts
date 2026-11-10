import { searchCollegesApi } from "../src/lib/colleges.functions";

async function testCall() {
  const result = await searchCollegesApi({
    data: {
      query: "Rajeev Gandhi",
      page: 1,
      limit: 10,
    },
  });
  console.log("Total:", result.totalCount);
  console.log("Results count:", result.results.length);
}

testCall().catch(console.error);
