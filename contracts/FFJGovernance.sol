// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./FFJToken.sol";

/**
 * @author  Franck Maussand.
 * @title   Allow to vote for proposals.
 * @dev     Contract administrator add voters and manage voting sessions.
 * @notice  Add voters; Add proposals; Then vote for a proposal.
 */
//contract FFJGovernance is Ownable, /*ReentrancyGuard,*/ AccessControl {
contract FFJGovernance is Ownable, AccessControl {

	uint private constant TITLE_LENGTH_MIN  = 5;
	uint private constant TITLE_LENGTH_MAX  = 24;
	uint private constant DESC_LENGTH_MIN   = 5;
	uint private constant DESC_LENGTH_MAX   = 96;
	uint private constant CHOICE_LENGTH_MIN = 1;
	uint private constant CHOICE_LENGTH_MAX = 20;
	uint private constant DATE_LENGTH       = 16;  // "2023-07-12 14h36"

	uint private DATE_RANGE_START = 1 hours;
	uint private DATE_RANGE_STOP  = 2 hours;

	bytes32 private immutable OWNER_ROLE     = keccak256("OWNER");
	bytes32 private immutable ORGANISER_ROLE = keccak256("ORGANISER");


	enum ProposalStatus {
		WAIT,    // wait for opening vote session
		OPENED,  // voting session is opened
		CLOSED,  // voting session is closed
		FAIL,    // quorum threshold not reached
		DISABLED // manualy disabled by `organiser`
	}
	uint private constant STATUS_MAX = 5;


	enum Choice {
		CHOICE1,
		CHOICE2,
		CHOICE3
	}
	uint private constant CHOICE_MAX = 3;


	struct Proposal {
		string title;        // proposal title
		string description;  // proposal desc. (short text as description)
		string displayDate;  // literal display date format "YYYY/MM/DD - HH:mm" set in front
		string[3] choiceDesc;
		uint  [3] choiceCounter;	// take account on weight
		uint  voteCount;       // number of vote for this proposal
		uint  start;           // (block timestamp)
		uint  stop;            // (block timestamp)
		ProposalStatus status;  // (see enum)
		bool magic;
	}
	mapping(address => mapping(uint => bool)) private _hasVoted;


	uint private _quorum;


	mapping (uint => Proposal) private _proposals;
	uint private _nnProposals;

	FFJToken private _token;

	event QuorumUpdated( uint _before, uint _after );
	event NewOrganiser( address _address);
	event StatusUpdated( uint _id, uint _status);
	event VotePerformed( address _address);


	constructor( FFJToken _tokenAddress, address _organiserAddress, uint _quorumValue) {
		_grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
		_grantRole(ORGANISER_ROLE, _organiserAddress);
		_grantRole(ORGANISER_ROLE, msg.sender);	// owner have also organiser role !
		_setQuorum( _quorumValue);
		_token = _tokenAddress;
	}	


	/**
	 * @dev restrict access if `account` role has been garanted to `admin`.
	 */
	modifier adminOnly() {
		_adminOnly();
		_;
	}

	/**
	 * @dev Modifiers code is copied in all instances where it's used, increasing bytecode size. By doing a refractor to the internal function, one can reduce bytecode size 
	 */
	function _adminOnly() internal view virtual {
		require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Access granted only to administrator");
	}

	/**
	 * @dev restrict access if `account` role has been garanted to `organiser`.
	 */
	modifier organiserOnly() {
		_organiserOnly();
		_;
	}

	/**
	 * @dev Modifiers code is copied in all instances where it's used, increasing bytecode size. By doing a refractor to the internal function, one can reduce bytecode size 
	 */
	function _organiserOnly() internal view virtual {
		require(hasRole(ORGANISER_ROLE, msg.sender), "Access granted only to organiser");
	}


	/**
	 * @notice  total supply of voters needed to aprove proposals.
	 */
	function getQuorum() external view returns(uint) {
		return _quorum;
	}

	/**
	 * @notice  Set number of voters needed to aprove proposals.
	 * @dev     External visibility, but restricted access to `account` with `organiser` role.
	 * @param   _quorumValue  quorum threshold.
	 */
	function setQuorum( uint _quorumValue) external organiserOnly() {
		_setQuorum( _quorumValue);
	}

	/**
	 * @notice  Set number of voters needed to aprove proposals.
	 * @dev     Internal access only, emit `QuorumUpdated` event after update.
	 * @param   _quorumValue  quorum threshold.
	 */
	function _setQuorum( uint _quorumValue) internal {
		uint prev = _quorum;
		_quorum   = _quorumValue;
		emit QuorumUpdated( prev, _quorumValue);
	}


	/**
	 * @notice  Add new ``account to the role of `organiser`.
	 * @dev     restricted access to `account` with `owner` role..
	 * @param   _organiserAddress address to add to the role of `organiser`.
	 */
	function setOrganiser( address _organiserAddress) external adminOnly() {
		_grantRole(ORGANISER_ROLE, _organiserAddress);
		emit NewOrganiser( _organiserAddress);
	}


	/**
	 * @notice  Allow to organiser to set a specific status to a specific proposal.
	 * @dev     emit StatusUpdated() event.
	 * @param   _id  proposal ID.
	 * @param   _status  (see ProposalStatus enum).
	 */
	function setStatus(uint _id, uint _status) external organiserOnly() {
		require( _id < _nnProposals, "out of bound index (> max)");
		require( _status < STATUS_MAX, "incorrect status");
		_proposals[_id].status = ProposalStatus(_status);
		emit StatusUpdated( _id, _status);
	}

	/**
	 * @notice  Automaticly update the status of a specific proposal.
	 * @dev     emit StatusUpdated() event.
	 * @param   _id  proposal ID.
	 */
	function updateStatus( uint _id) external {
		if(_proposals[_id].magic == false) {return;}
		if(_proposals[_id].status == ProposalStatus.DISABLED) {return;}

		uint t = block.timestamp;

		if( t < _proposals[_id].start) {
			_proposals[_id].status = ProposalStatus.WAIT;
			emit StatusUpdated( _id, uint(ProposalStatus.WAIT));
			return;
		}

		ProposalStatus returned = ProposalStatus.OPENED;

		if( t >= _proposals[_id].stop) {
			if(_proposals[_id].voteCount >= _quorum) {
				returned = ProposalStatus.CLOSED;
			} else {
				returned = ProposalStatus.FAIL;
			}
		}

		_proposals[_id].status = returned;
		emit StatusUpdated( _id, uint(returned));
	}


	/**
	 * @notice  Get total number of proposals with no criteria of sort.
	 */
	function getNnProposals() external view returns(uint) {
		return _nnProposals;
	}

	/**
	 * @notice  Return full data for a proposal specified by its `id`.
	 * @dev     Revert if out of bound index.
	 * @param   _id  id of a proposal.
	 */
	function getProposalById( uint _id) external view returns(Proposal memory) {
		require( _id < _nnProposals, "out of bound index (> max)");
		return _proposals[_id];
	}

	/**
	 * @dev Returns the length of a given string
	 *
	 * @param _str The string to measure the length of
	 * @return The length of the input string
	 */
	function _strlen(string memory _str) internal pure returns(uint256) {
		return bytes(_str).length;
	}

	/**
	 * @notice  Check if a string are within length limits.
	 * @dev     use _strlen() function (see below).
	 * @param   _text  string to evaluate.
	 * @param   _min  minimum length.
	 * @param   _max  maximum length.
	 */
	function _checkLength( string memory _text, uint _min, uint _max) internal pure {
		uint l = _strlen( _text);
		require( l >= _min, "too short string");
		require( l <= _max, "too long string");
	}

	/**
	 * @notice  Allow to every organiser to add a proposal for voting.
	 * @dev     provide checks on string length (min & max), set struct and add proposal to mapping.
	 * @param   _title        title (one line).
	 * @param   _description  description (short text).
	 * @param   _date         standard date format, set by front code.
	 * @param   _choice1Desc  choice 1 (one line).
	 * @param   _choice2Desc  choice 2 (one line).
	 * @param   _choice3Desc  choice 3 (one line).
	 * @param   _start  hours.
	 * @param   _stop   hours.
	 */
	function addProposal(
		string memory _title,
		string memory _description,
		string memory _date,
		string memory _choice1Desc,
		string memory _choice2Desc,
		string memory _choice3Desc,
		uint _start,
		uint _stop
	) external organiserOnly() returns(uint) {
		// Check if the proposal title and description are within length limits
		_checkLength( _title,       TITLE_LENGTH_MIN,  TITLE_LENGTH_MAX);
		_checkLength( _description, DESC_LENGTH_MIN,   DESC_LENGTH_MAX);
		_checkLength( _date,        DATE_LENGTH,       DATE_LENGTH);
		_checkLength( _choice1Desc, CHOICE_LENGTH_MIN, CHOICE_LENGTH_MAX);
		_checkLength( _choice2Desc, CHOICE_LENGTH_MIN, CHOICE_LENGTH_MAX);
		_checkLength( _choice3Desc, CHOICE_LENGTH_MIN, CHOICE_LENGTH_MAX);

		//require( _start < _stop, "Invalid date start/stop");
		// (block timestamp as seconds since unix epoch)
		_start = block.timestamp + _start * 1 hours;
		_stop  = block.timestamp + _stop  * 1 hours;
		require( _start >= (block.timestamp + DATE_RANGE_START), "Start date too close");
		require( (_start + DATE_RANGE_STOP) <= _stop, "Stop date too close");

		string[3] memory choiceDesc = [
			_choice1Desc,
			_choice2Desc,
			_choice3Desc
		];

		uint[3] memory counters;

		_proposals[_nnProposals] = Proposal(
			_title,
			_description,
			_date,
			choiceDesc,
			counters,
			0,      // voteCount
			_start, // start
			_stop,  // stop
			ProposalStatus.WAIT,
			true
		);

		//Voted memory v;
		//_hasVoted[];

		unchecked{++_nnProposals;}
		return _nnProposals;
	}


	/**
	 * @notice  Allow administrator to modify date range.
	 * @dev     Allow administrator to modify date range.
	 * @param   start  seconds.
	 * @param   stop   seconds.
	 */
	function setDateRange(uint start, uint stop) public adminOnly() {
		DATE_RANGE_START = start * 1 seconds;
		DATE_RANGE_STOP  = stop  * 1 seconds;
	}

	/**
	 * @notice  Return the date range (start & stop).
	 */
	function getDateRange() public view adminOnly() returns(uint[2] memory) {
		return [DATE_RANGE_START, DATE_RANGE_STOP];
	}


	/**
	 * @notice  FFJToken owner can perform a vote.
	 * @dev     vote is mainly drived by 2 things proposal status and vote token.`VotePerformed` event is emited.
	 * @param   _id  proposal ID.
	 * @param   choice  for wich choice we vote for (see `Choice` enum).
	 */
	function vote(uint _id, uint choice) external {
		require( !hasRole(ORGANISER_ROLE, msg.sender), "Forbiden to organiser");
		require( choice < CHOICE_MAX, "Incorrect choice");
		require( _id < _nnProposals, "Incorrect proposal index");
		require( _proposals[_id].magic == true, "Incorrect proposal");
		require( _proposals[_id].status == ProposalStatus.OPENED, "Incorrect proposal status");
		//require( _hasVoted[_id].addr[msg.sender] == false, "Already voted");
		require( _hasVoted[msg.sender][_id] == false, "Already voted");

		uint nnToken = _checkIfRegular();
		require( nnToken > 0,  "Access only with appropriated token number");
		require( nnToken <= 5, "Access only with appropriated token number");

		unchecked{ _proposals[_id].voteCount++;}
		unchecked{ _proposals[_id].choiceCounter[choice] += nnToken;}
		_hasVoted[msg.sender][_id] = true;
		emit VotePerformed(msg.sender);
	}

	/**
	 * @dev     If regular voter, return the number of token of the current `account`.
	 */
	function _checkIfRegular() internal view returns(uint) {
		return _token.balanceOf( msg.sender);
	}

}
