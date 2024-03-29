"""Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved. 
SPDX-License-Identifier: MIT-0
"""
import json
import csv
import boto3
import os
import re

s3 = boto3.client('s3')
bucket_name = os.environ['DATA_BUCKET']

classifications = []
with open ("classification.csv") as classification_csv:
    csv_reader = csv.DictReader(classification_csv)
    for row in csv_reader:    
        classifications.append(row)

def handle(event, context):
    objects = s3.list_objects_v2(Bucket=bucket_name)

    json_contents = []
    for obj in objects['Contents']:
        key = obj['Key']
        print(key)
        if key.endswith('.json'): # Only process JSON files
            response = s3.get_object(Bucket=bucket_name, Key=key)
            contents = response['Body'].read().decode('utf-8')
            print(contents)
            json_contents.extend(json.loads(contents))

    type_total_dict = {}
    for transaction in json_contents:
        if 'Transaction' in transaction and transaction['Debit'] != "" and transaction['Debit'] < 800000:
            classification = classify_transaction(transaction['Transaction'])
            type = classification['type']
            sub_type = classification['subtype']
            transaction['Type'] = type
            transaction['Subtype'] = sub_type

            try:
                if 'Credit' in transaction and transaction['Credit'] != "":
                    if type in type_total_dict:
                        if sub_type in type_total_dict[type]:
                            type_total_dict[type][sub_type] = float("{:.2f}".format(type_total_dict[type][sub_type])) + get_amount(transaction['Credit'])
                        else:
                            type_total_dict[type][sub_type] = get_amount(transaction['Credit'])
                    else:
                        type_total_dict[type] = {} 
                        type_total_dict[type][sub_type] = get_amount(transaction['Credit'])
                if 'Debit' in transaction and transaction['Debit'] != "":
                    if type in type_total_dict:
                        if sub_type in type_total_dict[type]:
                            type_total_dict[type][sub_type] = float("{:.2f}".format(type_total_dict[type][sub_type])) + get_amount(transaction['Debit'])
                        else:
                            type_total_dict[type][sub_type] = get_amount(transaction['Debit'])
                    else:
                        type_total_dict[type] = {} 
                        type_total_dict[type][sub_type] = get_amount(transaction['Debit'])
            except ValueError as ve:
                print(ve)

    print(type_total_dict)
    print(json.dumps(type_total_dict, indent = 4))
    
    income_expenditure = {}

    income_expenditure['Income'] = {}
    income_expenditure['Expenditure'] = {}
    income_expenditure['Income']['Employment'] = {}
    
    income_expenditure['Income']['Employment']['Salary'] = type_total_dict.pop('Employment')
    income_expenditure['Expenditure'] = type_total_dict
    
    d = income_expenditure['Income']['Employment']
    total_salary = 0
    for i in d:
        for j, k in d[i].items():
            total_salary += k
    
    d = income_expenditure['Expenditure']
    total_expenditure = 0
    for i in list(d):
        total = 0
        for j, k in list(d[i].items()):
            total += k
            d[i]['Total'] = total
            total_expenditure += k

    income_expenditure['Income']['Employment']['Salary']['Total'] = total_salary
    income_expenditure['Expenditure']['Total'] = total_expenditure

    result = {'incomeExpenditure': income_expenditure, 'summary': type_total_dict, 'transactions': json_contents}

    return {
        'statusCode': 200,
        'headers': {
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(result)
    }                

def get_amount(amount_str):
    non_decimal = re.compile(r'[^\d.]+')
    return float("{:.2f}".format(float(non_decimal.sub('',str(amount_str)).replace(",", ""))))


def classify_transaction(description):
    for classification in classifications:
        if classification['key'] in description.lower():
            return classification
    return {'key': '', 'type': 'Unknown', 'subtype': 'Unclassified'}