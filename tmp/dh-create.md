Fetch the complete documentation index at: https://delhivery-express-api-doc.readme.io/llms.txt. Use this file to discover all available pages before exploring further. Append .md to any documentation page URL to get its markdown version.

# /test/:create-order

# OpenAPI definition

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "Warehouse Management API",
    "version": "3"
  },
  "servers": [
    {
      "url": "https://staging-express.delhivery.com"
    }
  ],
  "components": {
    "securitySchemes": {
      "sec0": {
        "type": "apiKey",
        "in": "query",
        "name": "api_key"
      }
    }
  },
  "security": [
    {
      "sec0": []
    }
  ],
  "paths": {
    "/api/cmu/create.json": {
      "post": {
        "summary": "/test/:create-order",
        "description": "",
        "operationId": "testcreate-order",
        "parameters": [
          {
            "name": "Authorization",
            "in": "header",
            "description": "Token XXXXXXXXXXXXXXXXX",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "Content-Type",
            "in": "header",
            "description": "application/json",
            "schema": {
              "type": "string",
              "default": "application/json"
            }
          }
        ],
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "shipments": {
                    "type": "object",
                    "required": [
                      "add",
                      "phone",
                      "payment_mode",
                      "name",
                      "order",
                      "cosignee_gst_amount",
                      "integrated_gst_amount",
                      "ewbn",
                      "cosignee_gst_tin",
                      "hsn_code",
                      "gst_cess_amount"
                    ],
                    "properties": {
                      "add": {
                        "type": "string"
                      },
                      "address_type": {
                        "type": "string"
                      },
                      "phone": {
                        "type": "string"
                      },
                      "payment_mode": {
                        "type": "string"
                      },
                      "name": {
                        "type": "string"
                      },
                      "pin": {
                        "type": "integer",
                        "format": "int32"
                      },
                      "order": {
                        "type": "string"
                      },
                      "shipping_mode": {
                        "type": "string"
                      },
                      "cosignee_gst_amount": {
                        "type": "string"
                      },
                      "integrated_gst_amount": {
                        "type": "string"
                      },
                      "ewbn": {
                        "type": "string"
                      },
                      "cosignee_gst_tin": {
                        "type": "string"
                      },
                      "hsn_code": {
                        "type": "string"
                      },
                      "gst_cess_amount": {
                        "type": "string"
                      },
                      "tax_value": {
                        "type": "string"
                      },
                      "seller_tin": {
                        "type": "string"
                      },
                      "seller_gst_amount": {
                        "type": "string"
                      },
                      "seller_inv": {
                        "type": "string"
                      },
                      "city": {
                        "type": "string"
                      },
                      "company_value": {
                        "type": "string"
                      },
                      "weight": {
                        "type": "string"
                      },
                      "return_state": {
                        "type": "string"
                      },
                      "document_number": {
                        "type": "string"
                      },
                      "od_distance": {
                        "type": "string"
                      },
                      "sales_tax_form_ack_no": {
                        "type": "string"
                      },
                      "document_type": {
                        "type": "string"
                      },
                      "seller_cst": {
                        "type": "string"
                      },
                      "seller_name": {
                        "type": "string"
                      },
                      "fragile_shipment": {
                        "type": "string"
                      },
                      "return_city": {
                        "type": "string"
                      },
                      "return_phone": {
                        "type": "string"
                      },
                      "shipment_height": {
                        "type": "integer",
                        "format": "int32"
                      },
                      "shipment_width": {
                        "type": "integer",
                        "format": "int32"
                      },
                      "shipment_length": {
                        "type": "integer",
                        "format": "int32"
                      },
                      "category_of_goods": {
                        "type": "string"
                      },
                      "cod_amount": {
                        "type": "integer",
                        "format": "int32"
                      },
                      "return_country": {
                        "type": "string"
                      },
                      "document_date": {
                        "type": "string"
                      },
                      "taxable_amount": {
                        "type": "string"
                      },
                      "products_desc": {
                        "type": "string"
                      },
                      "state": {
                        "type": "string"
                      },
                      "dangerous_good": {
                        "type": "boolean"
                      },
                      "waybill": {
                        "type": "string"
                      },
                      "cosignee_tin": {
                        "type": "string"
                      },
                      "order_date": {
                        "type": "string"
                      },
                      "return_add": {
                        "type": "string"
                      },
                      "total_amount": {
                        "type": "integer",
                        "format": "int32"
                      },
                      "seller_add": {
                        "type": "string"
                      },
                      "country": {
                        "type": "string"
                      },
                      "return_pin": {
                        "type": "string"
                      },
                      "extra_parameters": {
                        "type": "object",
                        "properties": {}
                      },
                      "return_name": {
                        "type": "string"
                      },
                      "supply_sub_type": {
                        "type": "string"
                      },
                      "plastic_packaging": {
                        "type": "boolean"
                      },
                      "quantity": {
                        "type": "string"
                      }
                    }
                  },
                  "pickup_location": {
                    "type": "object",
                    "required": [
                      "name"
                    ],
                    "properties": {
                      "name": {
                        "type": "string"
                      },
                      "city": {
                        "type": "string"
                      },
                      "pin_code": {
                        "type": "string"
                      },
                      "country": {
                        "type": "string"
                      },
                      "phone": {
                        "type": "string"
                      },
                      "add": {
                        "type": "string"
                      }
                    }
                  }
                }
              },
              "examples": {
                "Full payload for order creation": {
                  "value": {
                    "shipments": [
                      {
                        "add": "M25,NelsonMarg",
                        "address_type": "home/office",
                        "phone": "1234567890",
                        "payment_mode": "Prepaid/COD/Pickup/REPL",
                        "name": "name-of-the-consignee",
                        "pin": 325007,
                        "order": "orderid",
                        "shipping_mode": "Surface/Express",
                        "consignee_gst_amount": "for ewaybill-incase of intra-state required only",
                        "integrated_gst_amount": "for ewaybill-incase of intra-state required only",
                        "ewbn": "if ewbn is there no need to send additional keys for generating ewaybill only if the total package amount is greater than or equal to 50k",
                        "consignee_gst_tin": "consignee_gst_tin",
                        "seller_gst_tin": "seller_gst_tin",
                        "client_gst_tin": "client_gst_tin",
                        "hsn_code": "Required for ewaybill-hsn_code",
                        "gst_cess_amount": "for ewaybill-gst_cess_amount",
                        "tax_value": "taxvalue",
                        "seller_tin": "sellertin",
                        "seller_gst_amount": "for ewaybill-incase of intra-state required only",
                        "seller_inv": "sellerinv",
                        "city": "Kota",
                        "commodity_value": "commodityvalue",
                        "weight": "weight(gms)",
                        "return_state": "returnstate",
                        "document_number": "for ewaybill-document_number,only mandatory in case of ewbn",
                        "od_distance": "ditance between origin and destination",
                        "sales_tax_form_ack_no": "ackno.",
                        "document_type": "for ewaybill-document_type,only mandatory in case of ewbn",
                        "seller_cst": "sellercst",
                        "seller_name": "sellername",
                        "fragile_shipment": "true",
                        "return_city": "returncity",
                        "return_phone": "returnphone",
                        "shipment_height": 10,
                        "shipment_width": 11,
                        "shipment_length": 12,
                        "category_of_goods": "categoryofgoods",
                        "cod_amount": 2125,
                        "return_country": "returncountry",
                        "document_date": "for ewaybill-datetime,mandatory in case of ewbn",
                        "taxable_amount": "for ewaybill-taxable_amount in case of multiple items only",
                        "products_desc": "for ewaybill-mandatory,incase of intra-state required only",
                        "state": "Rajasthan",
                        "dangerous_good": "True/False",
                        "waybill": "waybillno.(trackingid)",
                        "consignee_tin": "consigneetin",
                        "order_date": "2017-05-20 12:00:00",
                        "return_add": "returnaddress",
                        "total_amount": 21840,
                        "seller_add": "selleradd",
                        "country": "India",
                        "return_pin": "returnpin",
                        "extra_parameters": {
                          "return_reason": "string"
                        },
                        "return_name": "name",
                        "supply_sub_type": "for ewaybill-supply_sub_type,mandatory in case of ewbn",
                        "plastic_packaging": "true/false",
                        "quantity": "quantity"
                      }
                    ],
                    "pickup_location": {
                      "name": "client-warehouse-name-as-registered-with-delhivery",
                      "city": "city",
                      "pin": "pin-code",
                      "country": "country",
                      "phone": "phoneno.",
                      "add": "address-of-warehouse"
                    }
                  }
                },
                "Sample payload for forward flow": {
                  "value": {
                    "pickup_location": {
                      "name": "name of pickup/warehouse location registered with delhivery"
                    },
                    "shipments": [
                      {
                        "return_pin": "110096",
                        "return_city": "Delhi",
                        "return_phone": "1111111111",
                        "return_add": "address",
                        "return_state": "Delhi",
                        "return_country": "India",
                        "order": "123467800",
                        "phone": "1111111111",
                        "products_desc": "product description",
                        "cod_amount": "1.0",
                        "name": "Customer_name",
                        "country": "India",
                        "order_date": "2018-05-18 06:22:43",
                        "total_amount": "1.0",
                        "seller_add": "",
                        "add": "jaipur, ",
                        "seller_name": "",
                        "seller_inv": "",
                        "pin": "110096",
                        "quantity": "1",
                        "payment_mode": "COD",
                        "state": "Delhi",
                        "city": "Delhi"
                      }
                    ]
                  }
                },
                "Sample payload for reverse flow": {
                  "value": {
                    "pickup_location": {
                      "name": "Client's warehouse"
                    },
                    "shipments": [
                      {
                        "waybill": "",
                        "name": "Random Org Inc.",
                        "order": "SGHJ440954655B",
                        "products_desc": "clothing",
                        "order_date": "1970-01-01T05:30:00.000000",
                        "payment_mode": "Pickup",
                        "total_amount": 1000,
                        "add": "H.no 64/6, Officer's Colony n Manekshaw Society n Delhi cantt n",
                        "city": "Delhi",
                        "state": "Delhi",
                        "country": "India",
                        "phone": "1111111111",
                        "pin": "110010",
                        "return_add": "abcd",
                        "return_city": "Bangalore",
                        "return_country": "India",
                        "return_phone": "1111111111",
                        "return_pin": "560002",
                        "return_state": "Karnataka",
                        "extra_parameters": null,
                        "shipment_width": null,
                        "shipment_height": null,
                        "weight": "1000.0 gm",
                        "quantity": 1,
                        "seller_inv": null,
                        "seller_name": "",
                        "seller_add": "abcd",
                        "seller_gst_tin": "31BFGPD7096P1ZP",
                        "hsn_code": null
                      }
                    ]
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "200",
            "content": {
              "application/json": {
                "examples": {
                  "Result": {
                    "value": "{\n    \"cash_pickups_count\": 0,\n    \"package_count\": 0,\n    \"upload_wbn\": \"UPL2091701343621419496\",\n    \"replacement_count\": 0,\n    \"rmk\": \"An internal Error has occurred, Please get in touch with client.support@delhivery.com\",\n    \"pickups_count\": 0,\n    \"packages\": [],\n    \"cash_pickups\": 0,\n    \"cod_count\": 0,\n    \"success\": false,\n    \"prepaid_count\": 0,\n    \"error\": true,\n    \"cod_amount\": 0\n}\n\nSolution : pincode is must to pass for successful order creation"
                  }
                },
                "schema": {
                  "oneOf": [
                    {
                      "type": "object",
                      "properties": {}
                    },
                    {
                      "type": "object",
                      "properties": {
                        "cash_pickups_count": {
                          "type": "integer",
                          "example": 0,
                          "default": 0
                        },
                        "cod_count": {
                          "type": "integer",
                          "example": 0,
                          "default": 0
                        },
                        "success": {
                          "type": "boolean",
                          "example": false,
                          "default": true
                        },
                        "package_count": {
                          "type": "integer",
                          "example": 1,
                          "default": 0
                        },
                        "upload_wbn": {
                          "type": "string",
                          "example": "UPL5504163861590512101"
                        },
                        "replacement_count": {
                          "type": "integer",
                          "example": 0,
                          "default": 0
                        },
                        "cod_amount": {
                          "type": "integer",
                          "example": 0,
                          "default": 0
                        },
                        "prepaid_count": {
                          "type": "integer",
                          "example": 0,
                          "default": 0
                        },
                        "rmk": {
                          "type": "string",
                          "example": "An internal Error has occurred, Please get in touch with client.support@delhivery.com"
                        },
                        "pickups_count": {
                          "type": "integer",
                          "example": 0,
                          "default": 0
                        },
                        "packages": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "status": {
                                "type": "string",
                                "example": "Fail"
                              },
                              "waybill": {
                                "type": "string",
                                "example": "435510001503"
                              },
                              "refnum": {
                                "type": "string",
                                "example": "YCK2_14509409182145"
                              },
                              "client": {
                                "type": "string",
                                "example": "YUMCHEK - DFS"
                              },
                              "remarks": {
                                "type": "string",
                                "example": "Duplicate order id"
                              },
                              "sort_code": {},
                              "cod_amount": {
                                "type": "integer",
                                "example": 2000,
                                "default": 0
                              },
                              "payment": {
                                "type": "string",
                                "example": "COD"
                              }
                            }
                          }
                        },
                        "cash_pickups": {
                          "type": "integer",
                          "example": 0,
                          "default": 0
                        }
                      }
                    },
                    {
                      "type": "object",
                      "properties": {
                        "cash_pickups_count": {
                          "type": "integer",
                          "example": 0,
                          "default": 0
                        },
                        "cod_count": {
                          "type": "integer",
                          "example": 0,
                          "default": 0
                        },
                        "success": {
                          "type": "boolean",
                          "example": false,
                          "default": true
                        },
                        "package_count": {
                          "type": "integer",
                          "example": 0,
                          "default": 0
                        },
                        "upload_wbn": {},
                        "replacement_count": {
                          "type": "integer",
                          "example": 0,
                          "default": 0
                        },
                        "cod_amount": {
                          "type": "integer",
                          "example": 0,
                          "default": 0
                        },
                        "prepaid_count": {
                          "type": "integer",
                          "example": 0,
                          "default": 0
                        },
                        "error": {
                          "type": "boolean",
                          "example": true,
                          "default": true
                        },
                        "rmk": {
                          "type": "string",
                          "example": "client is not active"
                        },
                        "pickups_count": {
                          "type": "integer",
                          "example": 0,
                          "default": 0
                        },
                        "packages": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {}
                          }
                        },
                        "cash_pickups": {
                          "type": "integer",
                          "example": 0,
                          "default": 0
                        }
                      }
                    },
                    {
                      "type": "object",
                      "properties": {
                        "cash_pickups_count": {
                          "type": "integer",
                          "example": 0,
                          "default": 0
                        },
                        "cod_count": {
                          "type": "integer",
                          "example": 0,
                          "default": 0
                        },
                        "success": {
                          "type": "boolean",
                          "example": false,
                          "default": true
                        },
                        "package_count": {
                          "type": "integer",
                          "example": 1,
                          "default": 0
                        },
                        "upload_wbn": {
                          "type": "string",
                          "example": "UPL13214449689210393061"
                        },
                        "replacement_count": {
                          "type": "integer",
                          "example": 0,
                          "default": 0
                        },
                        "cod_amount": {
                          "type": "integer",
                          "example": 0,
                          "default": 0
                        },
                        "prepaid_count": {
                          "type": "integer",
                          "example": 0,
                          "default": 0
                        },
                        "rmk": {
                          "type": "string",
                          "example": "An internal Error has occurred, Please get in touch with client.support@delhivery.com"
                        },
                        "pickups_count": {
                          "type": "integer",
                          "example": 0,
                          "default": 0
                        },
                        "packages": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "status": {
                                "type": "string",
                                "example": "Fail"
                              },
                              "waybill": {
                                "type": "string",
                                "example": ""
                              },
                              "refnum": {
                                "type": "string",
                                "example": "YCK2_145094091821415"
                              },
                              "client": {
                                "type": "string",
                                "example": "YUMCHEK - DFS"
                              },
                              "remarks": {
                                "type": "string",
                                "example": "COD amount missing for COD/Cash package"
                              },
                              "sort_code": {},
                              "cod_amount": {
                                "type": "integer",
                                "example": 0,
                                "default": 0
                              },
                              "payment": {
                                "type": "string",
                                "example": "COD"
                              }
                            }
                          }
                        },
                        "cash_pickups": {
                          "type": "integer",
                          "example": 0,
                          "default": 0
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        },
        "deprecated": false,
        "security": []
      }
    }
  },
  "x-readme": {
    "headers": [],
    "explorer-enabled": true,
    "proxy-enabled": true
  },
  "x-readme-fauxas": true,
  "_id": "5a828756582a600012808953:62dadf7e29ea84003b8de016"
}
```