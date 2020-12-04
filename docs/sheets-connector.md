# Google Spreadsheets API Connector

## Overview
The Google Spreadsheet API Connector allows to import Tests list as well as Export their Results to Google Spreadsheet files via the [Google Sheets API](https://developers.google.com/sheets/api).

## Required Environmental Variables

- `SERVICE_ACCOUNT_CREDENTIALS` - The path to the Service Account json file.

## How to use

In order to use the [Google Sheets API](https://developers.google.com/sheets/api) via npm you need to complete these steps:


1. Create a new or use an existing [Google Service Account](https://cloud.google.com/iam/docs/creating-managing-service-accounts).

2. Create a new or existing Google Sheets file and share it with the Google Service Account email address with Editor permissions.
    1. This file should have Tab names useful to either fetch the Tests list, print the Results or both.
    In this example the file contains a `Tests` Sheet to fetch tests list (image below) and another Tab named `Results` where to print the results.

!["Google Sheets with Tests Tab"](img/sheets-connector-doc.png)

    2. Identify the Google Sheet ID (visibile in theURL between `/d/` and before `/edit`).
Example for this URL `https://docs.google.com/spreadsheets/d/GOOGLE_SHEET_ID/edit` the Google Sheet ID would be `GOOGLE_SHEET_ID`.

3. Download the service-account.json credentials from the [Service accounts page](https://console.cloud.google.com/iam-admin/serviceaccounts) and store them safely. In this example the file is stored inside a "tmp" folder.

4. Run the command selecting the appropriate tests and results connector. In this example 2 URLs are being tested via PSI API defined into a Google Sheet file Tab `Tests` and the results will be printed into the `Results` Tab.


```
SERVICE_ACCOUNT_CREDENTIALS=./tmp/service-account.json PSI_APIKEY=MY_API_KEY ./awp run sheets:[GOOGLE SHEET ID]/Tests sheets:[GOOGLE SHEET ID]/Results
```

5. The expected outcome once the tests are completed looks as the following below:

!["Google Sheets Results"](img/sheets-connector-doc2.png)