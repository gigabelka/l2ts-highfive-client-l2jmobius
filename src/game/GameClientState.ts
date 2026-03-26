/**
 * @fileoverview Game Client State - состояния конечного автомата игрового клиента
 * @module game/GameClientState
 *
 * Этот enum определяет состояния подключения к Game Server.
 * Используется в GameClient для управления жизненным циклом соединения.
 */

export enum GameClientState {
    IDLE = 'IDLE',
    CONNECTING = 'CONNECTING',
    WAIT_CRYPT_INIT = 'WAIT_CRYPT_INIT',
    WAIT_CHAR_LIST = 'WAIT_CHAR_LIST',
    WAIT_CHAR_SELECTED = 'WAIT_CHAR_SELECTED',
    WAIT_USER_INFO = 'WAIT_USER_INFO',
    IN_GAME = 'IN_GAME',
    ERROR = 'ERROR',
}
