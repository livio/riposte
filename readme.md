# Riposte

## Reply

| Name | Type | Description |
|------|------|-------------|
| id | String | Unique identifier for the original client's request all the way to the final response. |




### toObject
Converts the Reply instance into a JSON object that can be return in an API response.



#### Parameters
| # | Parameter | Required | Type | Default | Description |
|---|-----------|----------|------|---------|-------------|
| 1 | options | ```no``` | Object | ```{}``` | Overrides default behaviors when converting the reply instance to an object. | 
| 1 | options.sanitizeData | ```no``` | Boolean | ```false``` | When true, calls the ON_SANITIZE_DATA Riposte handler before adding the data to the response object. |
| 2 | cb | ```yes``` | Function | ```undefined``` |

## Express

res.reply 
res.replyOptions