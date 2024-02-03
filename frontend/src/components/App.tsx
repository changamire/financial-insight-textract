import React, { useState, useEffect } from "react";
import { Amplify, Auth, API } from "aws-amplify";
import { withAuthenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { DataGrid } from "@mui/x-data-grid";
import { ReactECharts, type ReactEChartsProps } from "./ReactEchart.tsx";

interface APIResponse {
  incomeExpenditure: {
    Income: any;
    Expenditure: any;
  };
  summary: any;
  transactions: [
    { Credit: string; Debit: string; Date: string; Transaction: string }
  ];
}

const config = {
  api: {
    REGION: "",
    URL: "",
  },
  cognito: {
    REGION: "",
    USER_POOL_ID: "",
    APP_CLIENT_ID: "",
  },
};

Amplify.configure({
  Auth: {
    mandatorySignIn: true,
    region: config.cognito.REGION,
    userPoolId: config.cognito.USER_POOL_ID,
    userPoolWebClientId: config.cognito.APP_CLIENT_ID,
  },
  API: {
    endpoints: [
      {
        name: "statement-insight-api",
        endpoint: config.api.URL,
        region: config.api.REGION,
        custom_header: async () => {
          return {
            Authorization: `Bearer ${(await Auth.currentSession())
              .getIdToken()
              .getJwtToken()}`,
          };
        },
      },
    ],
  },
});

function formatDataForSankey(apiResponse: APIResponse) {
  var data = [];
  var links = [];

  var incomeExpense = apiResponse.incomeExpenditure;
  data = getKeys(incomeExpense.Income);
  data.push({ name: "Expenditure" });
  data = data.concat(getKeys(incomeExpense.Expenditure));

  console.log(data);

  for (const employer in incomeExpense.Income.Employment.Salary) {
    links.push({
      source: employer,
      target: "Salary",
      value: incomeExpense.Income.Employment.Salary[employer].toFixed(2),
    });
  }
  links.push({
    source: "Salary",
    target: "Expenditure",
    value: incomeExpense.Income.Employment.Salary["Total"]
      ? incomeExpense.Income.Employment.Salary["Total"].toFixed(2)
      : 0,
  });

  for (const expense in incomeExpense.Expenditure) {
    if (expense != "Transfer") {
      links.push({
        source: "Expenditure",
        target: expense,
        value: incomeExpense.Expenditure[expense]["Total"]
          ? incomeExpense.Expenditure[expense]["Total"].toFixed(2)
          : 0,
      });
      for (const vendor in incomeExpense.Expenditure[expense]) {
        links.push({
          source: expense,
          target: vendor,
          value: incomeExpense.Expenditure[expense][vendor],
        });
      }
    }
  }

  return { data: data, links: links };
}

const names = new Map();

function getKeys(obj) {
  const keys = [];

  function traverse(obj) {
    for (let key in obj) {
      if (key != "Total" && key != "Income" && key != "Employment") {
        if (!names.get(key)) {
          names.set(key, key);
          keys.push({ name: key });
        }
      }
      if (typeof obj[key] === "object" && obj[key] !== null) {
        traverse(obj[key]);
      }
    }
  }
  traverse(obj);
  return keys;
}

const App = () => {
  const [response, setResponse] = useState([]);
  const [sankeyData, setSankeyData] = useState([]);
  const [rows, setRows] = useState([]);
  const [option, setOption] = useState({
    series: {
      type: "sankey",
      layout: "none",
      emphasis: { focus: "adjacency" },
      data: [],
      links: [],
    },
  });
  useEffect(() => {
    (async () => {
      const response = await API.get("statement-insight-api", "");
      setResponse(response);
      console.log(response);
      const sankeyData = formatDataForSankey(response);
      console.log(JSON.stringify(sankeyData));
      setSankeyData(sankeyData);
      setOption({
        series: {
          type: "sankey",
          layout: "none",
          emphasis: {
            focus: "adjacency",
          },
          data: sankeyData.data,
          links: sankeyData.links,
          lineStyle: {
            color: "gradient",
            curveness: 0.5,
          },
        },
      });
      const r: any = [];
      var id = 0;
      response.transactions.forEach((tx) => {
        r.push({
          id: id++,
          date: tx.Date,
          transaction: tx.Transaction,
          type: tx.Type,
          subType: tx.Subtype,
          debit: tx.Debit,
          credit: tx.Credit,
        });
      });
      setRows(r);
    })();
    return () => {};
  }, []);

  const columns = [
    { field: "id", headerName: "ID", width: 90 },
    {
      headerName: "Date",
      field: "date",
      width: 120,
    },
    {
      headerName: "Transaction",
      field: "transaction",
      width: 450,
    },
    {
      headerName: "Type",
      field: "type",
    },
    {
      headerName: "SubType",
      field: "subType",
    },
    {
      headerName: "Credit",
      field: "credit",
    },
    {
      headerName: "Debit",
      field: "debit",
    },
  ];

  return (
    <div>
      <div>
        <ReactECharts option={option} />
      </div>
      <div>
        <DataGrid
          rows={rows}
          columns={columns}
          initialState={{
            pagination: {
              paginationModel: {
                pageSize: 100,
              },
            },
          }}
          pageSizeOptions={[100]}
          checkboxSelection
          disableRowSelectionOnClick
        />
      </div>
    </div>
  );
};

export default withAuthenticator(App, true);
