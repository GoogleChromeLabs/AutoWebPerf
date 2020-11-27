# Google Spreadsheets API Connector

## Overview
The Google Spreadsheet API Connector allows to import Tests list as well as Export their Results to Google Spreadsheet files via the [Google Sheets API](https://developers.google.com/sheets/api).


## How to use

In order to use the [Google Sheets API](https://developers.google.com/sheets/api) via npm you need to complete these steps:


1. Create or use an existing [Google Service Account](https://cloud.google.com/iam/docs/creating-managing-service-accounts).

2. Create a Google Sheets file and share it with Editor permission with the previously created Google Service Account email address.
    1. This file should have Tab names useful to be used for both Tests information fetching and to write the Tests results.Example: you can have a Tab "Tests" and one other "Results" below:

!["Google Sheets with Tests Tab"](img/sheets-connector-doc.png)

    2. Save the Google Sheet ID, identified in the URL between d/ and before /edit.
Example for this URL https://docs.google.com/spreadsheets/d/GOOGLE_SHEET_ID/edit the Google Sheet ID would be "GOOGLE_SHEET_ID".

3. Download the service-account.json credentials from the [Service accounts page](https://console.cloud.google.com/iam-admin/serviceaccounts) and store them safely. In this example the file is stored inside a "tmp" folder.

4. Run the command selecting the appropriate tests and results connector. In this example 2 URLs are being tested via PSI API defined into a Google Sheet file Tab "Tests" and Results" will be printed into the "Results" Tab.


```
SERVICE_ACCOUNT_CREDENTIALS=./tmp/service-account.json PSI_APIKEY=MY_API_KEY ./awp run sheets:[GOOGLE SHEET ID]/Tests sheets:[GOOGLE SHEET ID]/Results
```

5. The expected outcome once the tests are completed looks as the following below:

!["Google Sheets Results"](img/sheets-connector-doc2.png)