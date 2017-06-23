/* eslint-env node, mocha */
const Promise = require('bluebird');

const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: "./mydb.sqlite"
  },
  debug: true,
  useNullAsDefault: true
});

var tableSchemas = {
	"users":[
		{username:"String"},
		{account_id:"String"}
	],
	"accounts":[
		{user_id:"String"},
		{owner_id:"String"}
	]
};

var fixturesData = {
	"users":[
		{"username":"rpavez","account_id":"1"},
		{"username":"athomas","account_id":"2"}
	],
	"accounts":[
		{"user_id":"1","owner_id":"1"}
	]
};

function createTable(tableName,structure)
{
	console.log(`Creating table ${tableName}`);
	var structure = tableSchemas[tableName];
	return knex.schema.createTableIfNotExists(tableName, (table) => {
	  table.increments();
	  for(var attr in structure){
	  	table.string(Object.keys(structure[attr])[0]);
	  }
	  table.timestamps();
	}).then(() => {
		console.log(`Table ${tableName} created`);
		return Promise.resolve();
	});
};

function batchInsertToTable(tableName,data)
{

	console.log(`Inserting data to table ${tableName}`);
	var chunkSize = 30;
	return knex.batchInsert(tableName, fixturesData[tableName], chunkSize)
	.returning('id');
}



beforeAll(() => {
	if(!process.env.ds){
		return Promise.resolve();
	}
	return Promise.each(Object.keys(tableSchemas),(tableName)=>{
		return knex.schema.dropTable(tableName);
	})
	.then(()=>{
		return Promise.each(Object.keys(tableSchemas),(tableName)=>{
			return createTable(tableName)
			.then(batchInsertToTable(tableName));
		});
	})
	.then(function () {
		console.log("Ready");
	});
});


/*
Operators

$and: {a: 5}           // AND (a = 5)
$or: [{a: 5}, {a: 6}]  // (a = 5 OR a = 6)
$gt: 6,                // > 6
$gte: 6,               // >= 6
$lt: 10,               // < 10
$lte: 10,              // <= 10
$ne: 20,               // != 20
$eq: 3,                // = 3
$not: true,            // IS NOT TRUE
$between: [6, 10],     // BETWEEN 6 AND 10
$notBetween: [11, 15], // NOT BETWEEN 11 AND 15
$in: [1, 2],           // IN [1, 2]
$notIn: [1, 2],        // NOT IN [1, 2]
$like: '%hat',         // LIKE '%hat'
$notLike: '%hat'       // NOT LIKE '%hat'
$iLike: '%hat'         // ILIKE '%hat' (case insensitive) (PG only)
$notILike: '%hat'      // NOT ILIKE '%hat'  (PG only)
$like: { $any: ['cat', 'hat']}
                       // LIKE ANY ARRAY['cat', 'hat'] - also works for iLike and notLike
$overlap: [1, 2]       // && [1, 2] (PG array overlap operator)
$contains: [1, 2]      // @> [1, 2] (PG array contains operator)
$contained: [1, 2]     // <@ [1, 2] (PG array contained by operator)
$any: [2,3]            // ANY ARRAY[2, 3]::INTEGER (PG only)

 */

/*
        return Sequence(user.id)
        .query(function(qb) {
            qb.whereIn('id', options.sequenceIds);
        })
        .fetchAll({
            withRelated: [
                'parts',
                'parts.tags',
                'features'
            ]
        })

 */

var operandsMap = {
    $gt              : ">",   // id > 6
    $gte             : ">=",   // id >= 6
    $lt              : "<",   // id < 10
    $lte             : "<=",   // id <= 10
    $ne              : "!=",   // id != 20
    $between         : "",   // BETWEEN 6 AND 10
    $notBetween      : "",   // NOT BETWEEN 11 AND 15
    $in              : "",   // IN [1, 2]
    $notIn           : "",   // NOT IN [1, 2]
    $like            : "",   // LIKE '%hat'
    $notLike         : "",   // NOT LIKE '%hat'
    $iLike           : "",   // ILIKE '%hat' (case insensitive)  (PG only)
    $notILike        : "",   // NOT ILIKE '%hat'  (PG only)
    $overlap         : "",   // && [1, 2] (PG array overlap operator)
    $contains        : "",   // @> [1, 2] (PG array contains operator)
    $contained       : "",   // <@ [1, 2] (PG array contained by operator)
    $any             : "",   // ANY ARRAY[2, 3]::INTEGER (PG only)
};

var processWhereKey = (q,where,key) => {
	if(key.match(/\$/)){
		if(key==='$or'){
			q.orWhere(where[key]);
		}
		else if(key==='$gt'){
			q.andWhere(key, '>', where[key]);
		}
		else {
			console.error(`Unsupported operand ${key}`)
		}
	}
	else {
		if( typeof(where[key]) === "object" ){
			for(var operand in where[key]){
				if(operandsMap[operand]&&operandsMap[operand]!=""){
					q.andWhere(key, operandsMap[operand], where[key][operand]);
				} 
				else {
					console.error(`Unsupported operand ${operand}`);
				}
			}
		}
		else {
			// Normal case
			q.andWhere(key, '=', where[key]);
		}
	}
};

var sequelizeWhereTransform = (query,qb) => {
	return qb.andWhere((q)=>{
		for(var where_key in query.where){
			processWhereKey(q,query.where,where_key);
		}
	});
};

var queryWrapper = (tableName,query) => {
	var qb = knex
	.select('*')
	.from(tableName);

	return sequelizeWhereTransform(query,qb);
};
	 
test('Basic query', () => {
	var query = {
		where:{
			username: "rpavez",
			account_id: {
				$gt: 0,
				$gte: 6
			}
		}
	};
	queryWrapper('users',query)
	.then((data)=>{
		console.log(data);
		return expect(data instanceof Array).toBe(true);
	})
});


// test('Query with left join', () => {
// 	knex.select('*').from('users').leftJoin('accounts', 'users.id', 'accounts.user_id')
// 	.then(function (data) {
// 		console.log(data)
// 		(data instanceof Array).toBe(true);
// 	});
// });
