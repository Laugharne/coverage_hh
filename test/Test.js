const Governance = artifacts.require("./FFJGovernance.sol");
const Token      = artifacts.require("./FFJToken.sol");
const { BN , expectRevert, expectEvent, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');


contract("FFJ Governance", accounts => {

	const OWNER     = accounts[0];
	const ORGANISER = accounts[1];
	const VOTER_1   = accounts[2]; // voter with token (1)
	const VOTER_2   = accounts[3]; // voter with token (2)
	const VOTER_3   = accounts[4]; // not an organiser, no token

	const PROPS_1   = BN(0);
	const PROPS_2   = BN(1);
	const PROPS_BAD = BN(99);

	const CHOICE_1   = BN(0);
	const CHOICE_2   = BN(1);
	const CHOICE_3   = BN(2);
	const CHOICE_BAD = BN(3);

	const WAIT     = BN(0);
	const OPENED   = BN(1);
	const CLOSED   = BN(2);
	const FAIL     = BN(3);
	const DISABLED = BN(4);
	
	let gov;

	let token;
	const tokenName   = "FFJ Vote Token";
	const tokenSymbol = "FFJ";
	const tokenSupply = web3.utils.toWei('1000', 'ether');


	describe("Initialisation", function() {

		beforeEach(async function() {
			token = await Token.new( tokenName, tokenSymbol, tokenSupply, {from: OWNER});
			gov   = await Governance.new( token.address, ORGANISER, 4, {from: OWNER});
		});
		
		it("Ownership", async () => {
			expect( await gov.owner()).to.be.bignumber.equal( BN(OWNER));
		});
		
		it("Transfert Ownership", async () => {
			await gov.transferOwnership( ORGANISER, {from: OWNER});
			expect( await gov.owner()).to.be.bignumber.equal( BN(ORGANISER));
		});

		
	});

	describe("Quorum", function() {

		beforeEach(async function() {
			token = await Token.new( tokenName, tokenSymbol, tokenSupply, {from: OWNER});
			gov   = await Governance.new( token.address, ORGANISER, 4, {from: OWNER});
		});
		
		it("getQuorum()", async () => {
			expect( await gov.getQuorum()).to.be.bignumber.equal( BN(4));
		});

		it("setQuorum + getQuorum()", async () => {
			const q = 5;
			expectEvent(
				await gov.setQuorum( q, {from: ORGANISER}),
				"QuorumUpdated",
				{
					_before: BN(4),
					_after: BN(q)
				}
			);
		
			expect( await gov.getQuorum()).to.be.bignumber.equal( BN(q));
		});

		it("setQuorum() `organiser` access only", async () => {
			const q = 4;
			await expectRevert(
				gov.setQuorum( q+1, {from: VOTER_3}),
				"Access granted only to organiser"
			);
		
			expect( await gov.getQuorum()).to.be.bignumber.equal( BN(q));
			});

	});

	describe("Proposals", function() {

		beforeEach(async function() {
			token = await Token.new( tokenName, tokenSymbol, tokenSupply, {from: OWNER});
			gov   = await Governance.new( token.address, ORGANISER, 4, {from: OWNER});
		});
		
		it("getNnProposals()", async () => {
			expect( await gov.getNnProposals()).to.be.bignumber.equal( BN(0));
		});
		
		it("getProposalById()", async () => {

			const title1 = "Title 1";
			const title2 = "Title 2";
			const desc   = "Long Description";
			const date   = "2023/08/01 08:00";
			const c1     = "C1";
			const c2     = "C2";
			const c3     = "C3";

			expect( await gov.getNnProposals()).to.be.bignumber.equal( BN(0));

			await gov.addProposal(
				title1,
				desc,
				date,
				c1, c2, c3,
				12, 24
				,{from: ORGANISER}
			);

			await gov.addProposal(
				title2,
				desc,
				date,
				c1, c2, c3,
				12, 24
				,{from: ORGANISER}
			);

			expect( await gov.getNnProposals()).to.be.bignumber.equal( BN(2));

			let propStruct = await gov.getProposalById( BN(0), {from: VOTER_1});

			assert.equal(propStruct.title, title1, "Invalid title");
			propStruct = await gov.getProposalById( BN(1), {from: VOTER_1});
			assert.equal(propStruct.title, title2, "Invalid title");
			await expectRevert(
				gov.getProposalById( BN(3), {from: VOTER_1}), "out of bound index (> max)"
			);

		});

		it("addProposal() + getNnProposals()", async () => {

			expect( await gov.getNnProposals()).to.be.bignumber.equal( BN(0));

			const title = "Title";
			const desc  = "Long Description";
			const date  = "2023/08/01 08:00";
			const c1    = "C1";
			const c2    = "C2";
			const c3    = "C3";

			const empty = "";
			const too_long_string = "A".repeat(128);

			await gov.addProposal(
				title,
				desc,
				date,
				c1, c2, c3,
				12, 24
				,{from: ORGANISER}
			);

			expect( await gov.getNnProposals()).to.be.bignumber.equal( BN(1));

			let propStruct = await gov.getProposalById( BN(0), {from: OWNER});

			assert.equal(propStruct.title, title, "Invalid title");
			assert.equal(propStruct.description, desc, "Invalid description");
			assert.equal(propStruct.displayDate, date, "Invalid date");
			assert.equal(propStruct.choiceDesc[0], c1, "Invalid choice #1");
			assert.equal(propStruct.choiceDesc[1], c2, "Invalid choice #2");
			assert.equal(propStruct.choiceDesc[2], c3, "Invalid choice #3");
			
			expect(propStruct.choiceCounter[0]).to.be.bignumber.equal( BN(0));
			expect(propStruct.choiceCounter[1]).to.be.bignumber.equal( BN(0));
			expect(propStruct.choiceCounter[2]).to.be.bignumber.equal( BN(0));
			
			expect(propStruct.voteCount).to.be.bignumber.equal( BN(0));
			expect(propStruct.status).to.be.bignumber.equal( BN(0));
			expect(propStruct.magic).to.be.true;

		});

		it("addProposal() ; checking `start` date too close", async () => {

			expect( await gov.getNnProposals()).to.be.bignumber.equal( BN(0));

			const title = "Title";
			const desc  = "Long Description";
			const date  = "2023/08/01 08:00";
			const c1    = "C1";
			const c2    = "C2";
			const c3    = "C3";

			const empty = "";
			const too_long_string = "A".repeat(65);

			await expectRevert(
				gov.addProposal(
					title,
					desc,
					date,
					c1, c2, c3,
					0, 15
					,{from: ORGANISER}
			), "Start date too close");

			expect( await gov.getNnProposals()).to.be.bignumber.equal( BN(0));

		});

		it("addProposal() ; checking `stop` date too close", async () => {

			expect( await gov.getNnProposals()).to.be.bignumber.equal( BN(0));

			const title = "Title";
			const desc  = "Long Description";
			const date  = "2023/08/01 08:00";
			const c1    = "C1";
			const c2    = "C2";
			const c3    = "C3";

			const empty = "";
			const too_long_string = "A".repeat(65);

			await expectRevert(
				gov.addProposal(
					title,
					desc,
					date,
					c1, c2, c3,
					12, 13
					,{from: ORGANISER}
			), "Stop date too close");

			expect( await gov.getNnProposals()).to.be.bignumber.equal( BN(0));

		});

		it("addProposal() ; fields length (minimum)", async () => {
			const title = "Title";
			const desc  = "Long Description";
			const date  = "2023/08/01 08:00";
			const c1    = "C1";
			const c2    = "C2";
			const c3    = "C3";

			const empty = "";
			//const too_long_string = "A".repeat(65);

			await expectRevert(
				gov.addProposal(
					empty,
					desc,
					date,
					c1, c2, c3,
					12, 13
					,{from: ORGANISER}
			), "too short string");

			await expectRevert(
				gov.addProposal(
					title,
					empty,
					date,
					c1, c2, c3,
					12, 13
					,{from: ORGANISER}
			), "too short string");

			await expectRevert(
				gov.addProposal(
					title,
					desc,
					empty,
					c1, c2, c3,
					12, 13
					,{from: ORGANISER}
			), "too short string");

			await expectRevert(
				gov.addProposal(
					title,
					desc,
					date,
					empty, c2, c3,
					12, 13
					,{from: ORGANISER}
			), "too short string");

			await expectRevert(
				gov.addProposal(
					title,
					desc,
					date,
					c1, empty, c3,
					12, 13
					,{from: ORGANISER}
			), "too short string");

			await expectRevert(
				gov.addProposal(
					title,
					desc,
					date,
					c1, c2, empty,
					12, 13
					,{from: ORGANISER}
			), "too short string");

		});

		it("addProposal() ; fields length (maximum)", async () => {
			const title = "Title";
			const desc  = "Long Description";
			const date  = "2023/08/01 08:00";
			const c1    = "C1";
			const c2    = "C2";
			const c3    = "C3";

			const too_long_string = "A".repeat(128);

			await expectRevert(
				gov.addProposal(
					too_long_string,
					desc,
					date,
					c1, c2, c3,
					12, 13
					,{from: ORGANISER}
			), "too long string");

			await expectRevert(
				gov.addProposal(
					title,
					too_long_string,
					date,
					c1, c2, c3,
					12, 13
					,{from: ORGANISER}
			), "too long string");

			await expectRevert(
				gov.addProposal(
					title,
					desc,
					too_long_string,
					c1, c2, c3,
					12, 13
					,{from: ORGANISER}
			), "too long string");

			await expectRevert(
				gov.addProposal(
					title,
					desc,
					date,
					too_long_string, c2, c3,
					12, 13
					,{from: ORGANISER}
			), "too long string");

			await expectRevert(
				gov.addProposal(
					title,
					desc,
					date,
					c1, too_long_string, c3,
					12, 13
					,{from: ORGANISER}
			), "too long string");

			await expectRevert(
				gov.addProposal(
					title,
					desc,
					date,
					c1, c2, too_long_string,
					12, 13
					,{from: ORGANISER}
			), "too long string");

		});

		it("Date range : get, set & access", async () => {
			let returned = await gov.getDateRange( {from: OWNER});
			expect( returned[0]).to.be.bignumber.equal( BN(3600));
			expect( returned[1]).to.be.bignumber.equal( BN(7200));
			await gov.setDateRange( 42, 1337, {from: OWNER});
			returned = await gov.getDateRange( {from: OWNER});

			expect( returned[0]).to.be.bignumber.equal( BN(42));
			expect( returned[1]).to.be.bignumber.equal( BN(1337));

			await expectRevert(
				gov.getDateRange( {from: VOTER_3}),
				"Access granted only to administrator"
			);

			await expectRevert(
				gov.setDateRange( 42, 1337, {from: VOTER_3}),
				"Access granted only to administrator"
			);

		});

		it("Status update", async () => {

			const title1 = "Title 1";
			const title2 = "Title 2";
			const desc   = "Long Description";
			const date   = "2023/08/01 08:00";
			const c1     = "C1";
			const c2     = "C2";
			const c3     = "C3";

			expect( await gov.getNnProposals()).to.be.bignumber.equal( BN(0));

			await gov.addProposal(
				title1,
				desc,
				date,
				c1, c2, c3,
				12, 24
				,{from: ORGANISER}
			);

			await gov.addProposal(
				title2,
				desc,
				date,
				c1, c2, c3,
				12, 24
				,{from: ORGANISER}
			);

			expect( await gov.getNnProposals()).to.be.bignumber.equal( BN(2));

			await gov.setStatus( BN(0), 1, {from: ORGANISER});
			await gov.setStatus( BN(1), 1, {from: ORGANISER});
			await expectRevert(
				gov.setStatus( BN(3), 1, {from: ORGANISER}), "out of bound index (> max)"
			);

			await expectRevert(
				gov.setStatus( BN(0), 10, {from: ORGANISER}), "incorrect status"
			);

			let propStruct = await gov.getProposalById( BN(0), {from: VOTER_1});
			assert.equal(propStruct.title, title1, "Invalid title");
			assert.equal(propStruct.status, BN(1), "Invalid status");
			propStruct = await gov.getProposalById( BN(1), {from: VOTER_1});
			assert.equal(propStruct.title, title2, "Invalid title");
			assert.equal(propStruct.status, BN(1), "Invalid status");

			expectEvent(
				await gov.updateStatus( BN(0), {from: ORGANISER}),
				"StatusUpdated", {
					_id: BN(0),
					_status: BN(0)
				}
			);

			propStruct = await gov.getProposalById( BN(0), {from: VOTER_1});
			assert.equal(propStruct.status, BN(0), "Invalid status");

			await expectRevert(
				gov.setStatus( BN(0), 1, {from: VOTER_3}), "Access granted only to organiser"
			);

		});


	});

	describe("Token", function() {

		beforeEach(async function() {
			token = await Token.new( tokenName, tokenSymbol, tokenSupply, {from: OWNER});
			gov   = await Governance.new( token.address, ORGANISER, 4, {from: OWNER});

			const ONE_TOKEN = web3.utils.toWei('1', 'wei');
			await token.transfer(VOTER_1, ONE_TOKEN, { from: OWNER });

			const TWO_TOKEN = web3.utils.toWei('2', 'wei');
			await token.transfer(VOTER_2, TWO_TOKEN, { from: OWNER });
		
		});

		it("Token : read quantity from `accounts`", async () => {
			expect( await token.balanceOf(VOTER_1, {from: OWNER})).to.be.bignumber.equal( BN(1)); // 1 token
			expect( await token.balanceOf(VOTER_2, {from: OWNER})).to.be.bignumber.equal( BN(2)); // 2 tokens
			expect( await token.balanceOf(VOTER_3, {from: OWNER})).to.be.bignumber.equal( BN(0)); // 0 token
		});

		it("Token : read name & symbol from an `account`", async () => {
			let name = await token.name({from: OWNER});
			assert.equal(name, "FFJ Vote Token", "Invalid Token Name");
			let symbol = await token.symbol({from: OWNER});
			assert.equal(symbol, "FFJ", "Invalid Token Symbol");
		});
	});

	describe("Vote", function() {

		beforeEach(async function() {
			token = await Token.new( tokenName, tokenSymbol, tokenSupply, {from: OWNER});
			gov   = await Governance.new( token.address, ORGANISER, 4, {from: OWNER});

			const ONE_TOKEN = web3.utils.toWei('1', 'wei');
			await token.transfer(VOTER_1, ONE_TOKEN, { from: OWNER });

			const TWO_TOKEN = web3.utils.toWei('2', 'wei');
			await token.transfer(VOTER_2, TWO_TOKEN, { from: OWNER });
		
			// Advance to the next block to correctly read time in
			// the solidity "now" function interpreted by ganache
			await time.advanceBlock();
		});

		it("check access by proposal status", async () => {

			const title1 = "Title 1";
			const title2 = "Title 2";
			const desc   = "Long Description";
			const date   = "2023/08/01 08:00";
			const c1     = "C1";
			const c2     = "C2";
			const c3     = "C3";

			const start1 = 1;
			const stop1  = 13;
			const start2 = 5;
			const stop2  = 17;

			//await gov.setDateRange(0,0, {from: OWNER});

			await gov.addProposal(
				title1,
				desc,
				date,
				c1, c2, c3,
				start1, stop1
				,{from: ORGANISER}
			);

			await expectRevert(
				gov.vote( PROPS_1, CHOICE_1, {from: VOTER_1}), "Incorrect proposal status"
			);

			await gov.setStatus( PROPS_1, CLOSED, {from: ORGANISER});
			await expectRevert(
				gov.vote( PROPS_1, CHOICE_1, {from: VOTER_1}), "Incorrect proposal status"
			);

			await gov.setStatus( PROPS_1, FAIL, {from: ORGANISER});
			await expectRevert(
				gov.vote( PROPS_1, CHOICE_1, {from: VOTER_1}), "Incorrect proposal status"
			);

			await gov.setStatus( PROPS_1, DISABLED, {from: ORGANISER});
			await expectRevert(
				gov.vote( PROPS_1, CHOICE_1, {from: VOTER_1}), "Incorrect proposal status"
			);

		});
		
		it("check access drived by bad parameters", async () => {

			const title1 = "Title 1";
			const title2 = "Title 2";
			const desc   = "Long Description";
			const date   = "2023/08/01 08:00";
			const c1     = "C1";
			const c2     = "C2";
			const c3     = "C3";

			const start1 = 1;
			const stop1  = 13;
			const start2 = 5;
			const stop2  = 17;

			await gov.addProposal(
				title1,
				desc,
				date,
				c1, c2, c3,
				start1, stop1
				,{from: ORGANISER}
			);

			await expectRevert(
				gov.vote( PROPS_1, CHOICE_BAD, {from: VOTER_1}), "Incorrect choice"
			);

			await expectRevert(
				gov.vote( PROPS_BAD, CHOICE_1, {from: VOTER_1}), "Incorrect proposal index"
			);

		});
		
		it("vote for an OPENED proposal", async () => {

			const title1 = "Title 1";
			const title2 = "Title 2";
			const desc   = "Long Description";
			const date   = "2023/08/01 08:00";
			const c1     = "C1";
			const c2     = "C2";
			const c3     = "C3";

			const start1 = 1;
			const stop1  = 13;
			const start2 = 5;
			const stop2  = 17;

			//await gov.setDateRange(0,0, {from: OWNER});

			await gov.addProposal(
				title1,
				desc,
				date,
				c1, c2, c3,
				start1, stop1
				,{from: ORGANISER}
			);

			await gov.setStatus( PROPS_1, OPENED, {from: ORGANISER});

			expectEvent(
				await gov.vote( PROPS_1, CHOICE_1, {from: VOTER_1}),
				"VotePerformed", {
					_address: VOTER_1
				}
			);

			await expectRevert(
				gov.vote( PROPS_1, CHOICE_1, {from: VOTER_1}),
				"Already voted"
			);

			await expectRevert(
				gov.vote( PROPS_1, CHOICE_1, {from: VOTER_3}),
				"Access only with appropriated token number"
			);

			await expectRevert(
				gov.vote( PROPS_1, CHOICE_1, {from: OWNER}),
				"Forbiden to organiser"
			);

			expectEvent(
				await gov.vote( PROPS_1, CHOICE_2, {from: VOTER_2}),
				"VotePerformed", {
					_address: VOTER_2
				}
			);

			let propStruct = await gov.getProposalById( PROPS_1, {from: VOTER_1});
			//console.log( propStruct);
			expect(propStruct.choiceCounter[CHOICE_1]).to.be.bignumber.equal( BN(1));
			expect(propStruct.choiceCounter[CHOICE_2]).to.be.bignumber.equal( BN(2));
			expect(propStruct.choiceCounter[CHOICE_3]).to.be.bignumber.equal( BN(0));
			expect(propStruct.voteCount).to.be.bignumber.equal( BN(2));

		});
		
		it("drive by life cycle", async () => {

			const title1 = "Title 1";
			const title2 = "Title 2";
			const desc   = "Long Description";
			const date   = "2023/08/01 08:00";
			const c1     = "C1";
			const c2     = "C2";
			const c3     = "C3";

			const start1 = 1;
			const stop1  = 13;
			const start2 = 5;
			const stop2  = 17;

			//await gov.setDateRange(0,0, {from: OWNER});

			await gov.addProposal(
				title1,
				desc,
				date,
				c1, c2, c3,
				start1, stop1
				,{from: ORGANISER}
			);

			await gov.addProposal(
				title2,
				desc,
				date,
				c1, c2, c3,
				start2, stop2
				,{from: ORGANISER}
			);

			await expectRevert(
				gov.vote( PROPS_1, CHOICE_1, {from: VOTER_1}), "Incorrect proposal status"
			);

			// Returns the time of the last mined block in seconds T
			//now = await time.latest();
			//console.log(`1 now   : ${now}`);

			await gov.updateStatus( PROPS_1, {from: VOTER_1});

			let propStruct = await gov.getProposalById( PROPS_1, {from: VOTER_1});
			//console.log(propStruct);
			let begin = propStruct.start;
			let end   = propStruct.stop;
			//console.log("begin   : "+begin);
			//console.log("end     : "+end);

			await time.increaseTo( begin);
			await gov.updateStatus( PROPS_1, {from: VOTER_1});

			//propStruct = await gov.getProposalById( PROPS_1, {from: VOTER_1});
			//console.log(propStruct);

			//now = await time.latest();
			//console.log(`2 now   : ${now}`);

			expectEvent(
				await gov.vote( PROPS_1, CHOICE_3, {from: VOTER_1}),
				"VotePerformed", {
					_address: VOTER_1
				}
			);

			//propStruct = await gov.getProposalById( PROPS_1, {from: VOTER_1});
			//console.log( propStruct);

			await time.increaseTo( end+1);
			await gov.updateStatus( PROPS_1, {from: VOTER_1});

			propStruct = await gov.getProposalById( PROPS_1, {from: VOTER_1});
			//console.log( propStruct);

			expect(propStruct.choiceCounter[CHOICE_1]).to.be.bignumber.equal( BN(0));
			expect(propStruct.choiceCounter[CHOICE_2]).to.be.bignumber.equal( BN(0));
			expect(propStruct.choiceCounter[CHOICE_3]).to.be.bignumber.equal( BN(1));
			expect(propStruct.voteCount).to.be.bignumber.equal( BN(1));
			expect(propStruct.status).to.be.bignumber.equal( FAIL);

			await gov.setStatus( PROPS_2, DISABLED, {from: ORGANISER});

			await expectRevert(
				gov.vote( PROPS_2, CHOICE_1, {from: VOTER_1}), "Incorrect proposal status"
			);

			// Returns the number of the last mined block
			//let latest = await time.latestBlock();
			//console.log(`1 latest: ${latest}`);

		});
		
	});

});
