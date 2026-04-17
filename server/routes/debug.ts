import type { Express, Request, Response } from "express";
import * as connectwise from "../services/connectwise";

export function registerDebugRoutes(app: Express) {
  app.get("/api/cw-debug/financial-breakdown/:companyId", async (req: Request, res: Response) => {
    try {
      const cwCompanyId = parseInt(req.params.companyId);
      const dateFrom = (req.query.from as string) || "2025-01-01";
      const dateTo = (req.query.to as string) || "2025-12-31";

      const apiGet = connectwise.apiGet;

      const invoices = await apiGet("/finance/invoices", {
        conditions: `company/id = ${cwCompanyId} AND date >= [${dateFrom}] AND date <= [${dateTo}]`,
        pageSize: "1000",
        orderBy: "date asc",
      });

      let agrInvoiceRevenue = 0;
      let stdInvoiceRevenue = 0;
      let miscInvoiceRevenue = 0;
      let progressInvoiceRevenue = 0;
      const invoiceBreakdown: any[] = [];
      for (const inv of invoices) {
        const amount = inv.total || 0;
        const type = inv.type || "Unknown";
        invoiceBreakdown.push({ id: inv.id, number: inv.invoiceNumber, type, total: amount, date: inv.date });
        if (type === "Agreement") agrInvoiceRevenue += amount;
        else if (type === "Standard") stdInvoiceRevenue += amount;
        else if (type === "Miscellaneous") miscInvoiceRevenue += amount;
        else if (type === "Progress") progressInvoiceRevenue += amount;
      }

      let allTimeRows: any[][] = [];
      let timeCols: string[] = [];
      let tPage = 1;
      while (true) {
        const timeReport = await apiGet("/system/reports/Time", {
          conditions: `company_recid = ${cwCompanyId} AND date_invoice >= [${dateFrom}] AND date_invoice <= [${dateTo}]`,
          pageSize: "250",
          page: String(tPage),
        });
        if (timeReport.column_definitions && timeCols.length === 0) {
          timeCols = timeReport.column_definitions.map((c: any) => Object.keys(c)[0]);
        }
        if (!timeReport.row_values || timeReport.row_values.length === 0) break;
        allTimeRows = allTimeRows.concat(timeReport.row_values);
        if (timeReport.row_values.length < 250) break;
        tPage++;
      }
      const timeColMap = new Map<string, number>();
      for (let i = 0; i < timeCols.length; i++) timeColMap.set(timeCols[i].toLowerCase(), i);
      const getTimeNum = (row: any[], col: string) => {
        const idx = timeColMap.get(col.toLowerCase());
        return idx != null ? Number(row[idx]) || 0 : 0;
      };
      const getTimeStr = (row: any[], col: string) => {
        const idx = timeColMap.get(col.toLowerCase());
        return idx != null ? String(row[idx] ?? "") : "";
      };
      let timeRevenue = 0;
      let timeCost = 0;
      let timeBilledRevenue = 0;
      let timeAgrCovered = 0;
      let totalHoursActual = 0;
      for (const row of allTimeRows) {
        const billableAmt = getTimeNum(row, "Billable_Amt");
        const hourlyCost = getTimeNum(row, "Hourly_Cost");
        const hoursActual = getTimeNum(row, "hours_actual");
        const agrAmtCovered = getTimeNum(row, "AgrAmtCovered");
        timeRevenue += billableAmt;
        timeCost += hourlyCost * hoursActual;
        timeBilledRevenue += (billableAmt - agrAmtCovered);
        timeAgrCovered += agrAmtCovered;
        totalHoursActual += hoursActual;
      }

      let allProdRows: any[][] = [];
      let prodCols: string[] = [];
      let pPage = 1;
      while (true) {
        const productReport = await apiGet("/system/reports/Product", {
          conditions: `company_recid = ${cwCompanyId} AND date_invoice >= [${dateFrom}] AND date_invoice <= [${dateTo}]`,
          pageSize: "250",
          page: String(pPage),
        });
        if (productReport.column_definitions && prodCols.length === 0) {
          prodCols = productReport.column_definitions.map((c: any) => Object.keys(c)[0]);
        }
        if (!productReport.row_values || productReport.row_values.length === 0) break;
        allProdRows = allProdRows.concat(productReport.row_values);
        if (productReport.row_values.length < 250) break;
        pPage++;
      }
      const prodColMap = new Map<string, number>();
      for (let i = 0; i < prodCols.length; i++) prodColMap.set(prodCols[i].toLowerCase(), i);
      const getProdNum = (row: any[], col: string) => {
        const idx = prodColMap.get(col.toLowerCase());
        return idx != null ? Number(row[idx]) || 0 : 0;
      };
      const getProdStr = (row: any[], col: string) => {
        const idx = prodColMap.get(col.toLowerCase());
        return idx != null ? String(row[idx] ?? "") : "";
      };
      let prodRevenue = 0;
      let prodCost = 0;
      let agrProdRevenue = 0;
      let agrProdCost = 0;
      let nonAgrProdRevenue = 0;
      let nonAgrProdCost = 0;
      for (const row of allProdRows) {
        const extCost = getProdNum(row, "Extended_Cost");
        const extPrice = getProdNum(row, "Extended_Price_Amount");
        const agr = getProdStr(row, "Agreement");
        prodRevenue += extPrice;
        prodCost += extCost;
        if (agr) {
          agrProdRevenue += extPrice;
          agrProdCost += extCost;
        } else {
          nonAgrProdRevenue += extPrice;
          nonAgrProdCost += extCost;
        }
      }

      const invoiceHeaders = await apiGet("/system/reports/InvoiceHeader", {
        conditions: `Company_RecID = ${cwCompanyId} AND Date_Invoice >= [${dateFrom}] AND Date_Invoice <= [${dateTo}]`,
        pageSize: "1000",
      });
      const ihCols = invoiceHeaders.column_definitions?.map((c: any) => Object.keys(c)[0]) || [];
      const getIHCol = (row: any[], col: string) => {
        const idx = ihCols.indexOf(col);
        return idx >= 0 ? row[idx] : null;
      };
      let ihAgrAmount = 0;
      let ihTimeAmount = 0;
      let ihMiscAmount = 0;
      let ihExpenseAmount = 0;
      let ihInvoiceAmount = 0;
      const ihBreakdown: any[] = [];
      for (const row of (invoiceHeaders.row_values || [])) {
        const agrAmt = Number(getIHCol(row, "AGR_Amount")) || 0;
        const timeAmt = Number(getIHCol(row, "Time_Amount")) || 0;
        const miscAmt = Number(getIHCol(row, "Misc_Amount")) || 0;
        const expAmt = Number(getIHCol(row, "Expense_Amount")) || 0;
        const invAmt = Number(getIHCol(row, "Invoice_Amount")) || 0;
        const invType = getIHCol(row, "Invoice_Type");
        const invNum = getIHCol(row, "Invoice_Number");
        ihAgrAmount += agrAmt;
        ihTimeAmount += timeAmt;
        ihMiscAmount += miscAmt;
        ihExpenseAmount += expAmt;
        ihInvoiceAmount += invAmt;
        ihBreakdown.push({ number: invNum, type: invType, total: invAmt, agrAmt, timeAmt, miscAmt, expAmt });
      }

      return res.json({
        period: `${dateFrom} to ${dateTo}`,
        cwTarget: { totalCost: 119688.72, totalRevenue: 238139.85, serviceCost: 14823.63, serviceRevenue: 25132.18, productsCost: 57327.75, productsRevenue: 73316.68, agreementsCost: 47537.34, agreementsRevenue: 139690.99 },
        invoiceApi: { agrInvoiceRevenue, stdInvoiceRevenue, miscInvoiceRevenue, progressInvoiceRevenue, totalInvoices: invoices.length },
        invoiceHeaderReport: { ihAgrAmount, ihTimeAmount, ihMiscAmount, ihExpenseAmount, ihInvoiceAmount, count: (invoiceHeaders.row_values || []).length },
        timeReport: { timeRevenue, timeCost, timeBilledRevenue, timeAgrCovered, totalHoursActual, rowCount: allTimeRows.length },
        productReport: { prodRevenue, prodCost, agrProdRevenue, agrProdCost, nonAgrProdRevenue, nonAgrProdCost, rowCount: allProdRows.length },
        derivedTotals: {
          revenueFromLineItems: timeBilledRevenue + prodRevenue,
          costFromLineItems: timeCost + prodCost,
        },
        expenseReport: await (async () => {
          try {
            const expData = await apiGet("/system/reports/Expense", {
              conditions: `Company_RecID = ${cwCompanyId} AND Date_Invoice >= [${dateFrom}] AND Date_Invoice <= [${dateTo}]`,
              pageSize: "1000",
            });
            const expCols = (expData.column_definitions || []).map((c: any) => Object.keys(c)[0]);
            const expColMap = new Map<string, number>();
            for (let i = 0; i < expCols.length; i++) expColMap.set(expCols[i].toLowerCase(), i);
            const getExpNum = (row: any[], col: string) => {
              const idx = expColMap.get(col.toLowerCase());
              return idx != null ? Number(row[idx]) || 0 : 0;
            };
            const getExpStr = (row: any[], col: string) => {
              const idx = expColMap.get(col.toLowerCase());
              return idx != null ? String(row[idx] ?? "") : "";
            };
            let totalExpCost = 0;
            let totalExpRevenue = 0;
            let agrExpCost = 0;
            let agrExpRevenue = 0;
            let nonAgrExpCost = 0;
            let nonAgrExpRevenue = 0;
            const sampleRows: any[] = [];
            for (const row of (expData.row_values || [])) {
              const cost = getExpNum(row, "Expense_Cost");
              const billAmt = getExpNum(row, "Bill_Amount");
              const agr = getExpStr(row, "Agreement");
              totalExpCost += cost;
              totalExpRevenue += billAmt;
              if (agr) { agrExpCost += cost; agrExpRevenue += billAmt; }
              else { nonAgrExpCost += cost; nonAgrExpRevenue += billAmt; }
              if (sampleRows.length < 3) {
                const desc = getExpStr(row, "Expense_Detail");
                const type = getExpStr(row, "Expense_Type");
                sampleRows.push({ type, desc, cost, billAmt, agreement: agr || null });
              }
            }
            return {
              columns: expCols,
              rowCount: (expData.row_values || []).length,
              totalExpCost, totalExpRevenue,
              agrExpCost, agrExpRevenue,
              nonAgrExpCost, nonAgrExpRevenue,
              sampleRows,
            };
          } catch (e: any) {
            return { error: e.message, columns: [] };
          }
        })(),
        invoiceBreakdown: invoiceBreakdown.slice(0, 5),
        ihBreakdown: ihBreakdown.slice(0, 5),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message, stack: e.stack });
    }
  });
}
